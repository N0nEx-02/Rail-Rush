<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/config.php';

const TOP_LIMIT = 5;
const MAX_LEVEL = 9999;
const MAX_TIME_SECONDS = 86400;
const MAX_ROTATIONS = 1000000;

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function cleanPlayerName($value): ?string
{
    if (!is_string($value)) {
        return null;
    }

    $collapsed = preg_replace('/\s+/u', ' ', trim($value));
    if (!is_string($collapsed) || $collapsed === '') {
        return null;
    }

    $length = function_exists('mb_strlen')
        ? mb_strlen($collapsed, 'UTF-8')
        : (int) preg_match_all('/./u', $collapsed);

    if ($length < 1 || $length > 8) {
        return null;
    }

    return $collapsed;
}

function parseIntInRange($value, int $min, int $max): ?int
{
    if (is_int($value)) {
        $number = $value;
    } elseif (is_string($value) && preg_match('/^\d+$/D', $value)) {
        $number = (int) $value;
    } else {
        return null;
    }

    return ($number >= $min && $number <= $max) ? $number : null;
}

function parseTimeTenths($value): ?int
{
    if (is_int($value) || is_float($value)) {
        $seconds = (float) $value;
    } elseif (is_string($value) && is_numeric($value)) {
        $seconds = (float) $value;
    } else {
        return null;
    }

    if (!is_finite($seconds) || $seconds < 0 || $seconds > MAX_TIME_SECONDS) {
        return null;
    }

    return (int) round($seconds * 10);
}

function cleanRunId($value): string
{
    if (is_string($value) && preg_match('/^[A-Za-z0-9_-]{8,64}$/', $value)) {
        return $value;
    }

    return bin2hex(random_bytes(16));
}

function fetchTopScores(PDO $pdo): array
{
    $statement = $pdo->query(
        'SELECT player_name, level, time_tenths, rotations
         FROM leaderboard_scores
         ORDER BY level DESC, time_tenths ASC, rotations ASC, id ASC
         LIMIT ' . TOP_LIMIT
    );

    return array_map(static function (array $row): array {
        return [
            'name' => (string) $row['player_name'],
            'level' => (int) $row['level'],
            'time' => round(((int) $row['time_tenths']) / 10, 1),
            'rotations' => (int) $row['rotations'],
        ];
    }, $statement->fetchAll());
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://localhost') {
    header('Access-Control-Allow-Origin: https://localhost');
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, Content-Type');
}

if ($method === 'OPTIONS') {
    header('Allow: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST, OPTIONS');
    respond(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

if (!extension_loaded('pdo_mysql')) {
    error_log('RailRush leaderboard requires the PHP pdo_mysql extension.');
    respond(['ok' => false, 'error' => 'Leaderboard database driver is unavailable.'], 503);
}

$port = (string) DB_PORT;
if (!ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
    error_log('RailRush leaderboard DB_PORT is invalid.');
    respond(['ok' => false, 'error' => 'Database configuration is invalid.'], 500);
}

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, (int) $port, DB_NAME),
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS leaderboard_scores (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            run_id VARCHAR(64) NOT NULL,
            player_name VARCHAR(8) NOT NULL,
            level INT UNSIGNED NOT NULL,
            time_tenths INT UNSIGNED NOT NULL,
            rotations INT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_run_id (run_id),
            KEY idx_leaderboard_rank (level, time_tenths, rotations, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
} catch (Throwable $error) {
    error_log('RailRush leaderboard DB connection failed: ' . $error->getMessage());
    respond(['ok' => false, 'error' => 'Database connection failed. Check api/config.php.'], 503);
}

try {
    if ($method === 'GET') {
        respond(['ok' => true, 'scores' => fetchTopScores($pdo)]);
    }

    $input = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($input)) {
        respond(['ok' => false, 'error' => 'Request body must be valid JSON.'], 400);
    }

    $name = cleanPlayerName($input['name'] ?? null);
    $level = parseIntInRange($input['level'] ?? null, 1, MAX_LEVEL);
    $timeTenths = parseTimeTenths($input['time'] ?? null);
    $rotations = parseIntInRange($input['rotations'] ?? null, 0, MAX_ROTATIONS);

    if ($name === null || $level === null || $timeTenths === null || $rotations === null) {
        respond(['ok' => false, 'error' => 'Invalid leaderboard entry data.'], 422);
    }

    $runId = cleanRunId($input['run_id'] ?? null);

    $statement = $pdo->prepare(
        'INSERT IGNORE INTO leaderboard_scores (run_id, player_name, level, time_tenths, rotations)
         VALUES (:run_id, :player_name, :level, :time_tenths, :rotations)'
    );
    $statement->execute([
        ':run_id' => $runId,
        ':player_name' => $name,
        ':level' => $level,
        ':time_tenths' => $timeTenths,
        ':rotations' => $rotations,
    ]);

    respond(['ok' => true, 'scores' => fetchTopScores($pdo)], 201);
} catch (Throwable $error) {
    error_log('RailRush leaderboard request error: ' . $error->getMessage());
    respond(['ok' => false, 'error' => 'Server error while processing leaderboard request.'], 500);
}

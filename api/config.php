<?php
declare(strict_types=1);

// Database credentials should be provided through environment variables.
const DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
const DB_PORT = getenv('DB_PORT') ?: '3306';
const DB_NAME = getenv('DB_NAME') ?: 'railrush';
const DB_USER = getenv('DB_USER') ?: 'root';
const DB_PASS = getenv('DB_PASS') ?: '';

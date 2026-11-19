# RailRush MySQL leaderboard setup

1. Copy the `Puzzle` folder into your XAMPP `htdocs` directory.
2. Start Apache and MySQL from the XAMPP Control Panel.
3. Open phpMyAdmin, select **Import**, and import `Puzzle/schema.sql`. This creates the `railrush` database and leaderboard table.
4. Edit `Puzzle/api/config.php` and enter your MySQL credentials in `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASS`.
5. Open the game through Apache, for example `http://localhost/Puzzle/railrush_puzzle_game.html`. The PHP API is at `Puzzle/api/leaderboard.php`.

The page opened directly as a `file://` URL continues to use browser-local leaderboard storage. The shared MySQL leaderboard requires the page to be served through Apache/PHP with the PDO MySQL extension enabled.

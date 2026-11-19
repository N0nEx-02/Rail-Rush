-- RailRush Leaderboard MySQL Schema
-- Import in phpMyAdmin or run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS railrush
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE railrush;

CREATE TABLE IF NOT EXISTS leaderboard_scores (
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
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

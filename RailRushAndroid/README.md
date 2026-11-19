# RailRush Android app

This folder wraps the RailRush HTML game in an Android app with Capacitor. The app works offline and saves its leaderboard in the app's local browser storage by default.

## Requirements

- Node.js 20 or newer (includes npm)
- Android Studio with the Android SDK installed
- An internet connection for the initial npm and Gradle downloads

## Build a debug APK

1. Copy `RailRushAndroid` into a folder on your Windows computer.
2. Open PowerShell in that folder and run:

   ```powershell
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
   ```

3. In Android Studio, allow Gradle sync to finish. If asked, install the Android SDK platform/build tools it requests.
4. Choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Find the debug installer at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to an Android device and open it to install. If Android asks, allow installs from that file manager.

To refresh the Android project after changing `www/index.html`, run `npx cap sync android` again.

## Optional MySQL leaderboard

The APK does not contain PHP or MySQL. It uses local leaderboard storage unless a reachable HTTPS API is configured.

1. Host the existing `Puzzle/api/leaderboard.php` and MySQL database on a server reachable by the device.
2. Edit `www/mobile-config.js` and set `window.RAILRUSH_API_URL` to the full HTTPS URL of `leaderboard.php`.
3. The included API allows the Capacitor Android origin `https://localhost` and its `GET`, `POST`, and `OPTIONS` requests. If you change the app's Android scheme, update the origin allowlist in `Puzzle/api/leaderboard.php`.
4. Run `npx cap sync android`, then build the APK again.

Do not put database credentials in this Android project. Keep them in the server-side `Puzzle/api/config.php`. Do not use `127.0.0.1` as the API host in the app; on a phone it refers to the phone itself, not your XAMPP computer. For local-network testing, use the computer's LAN IP and make sure Apache/firewall allow access. HTTPS hosting is recommended.

## Updating the game

`www/index.html` is the app's copy of `Puzzle/railrush_puzzle_game.html`. After editing the main game, copy it over `www/index.html` and keep the `mobile-config.js` script include and API configuration changes in the app copy.

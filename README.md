*Made with AI* /n
I used "Ask" from the Brave Browser/search engine to plan the whole project and write a prompt for Copilot in VS code using GPT-6 Luna. All free! It took about 8 hours. 
I am amazed by the power of this AI stuff. 
A week ago I could make a small app in PyCharm using tkinter. Now I have developed a android app that talks to a sever on my computer!!!
I have a few projects that I want to get done. 

# TaskDrop

TaskDrop is a local-only phone-to-desktop checklist for one Android phone and one Windows desktop on the same Wi-Fi network. The phone keeps tasks in Room until the desktop confirms them; the desktop stores its checklist in SQLite. No cloud account or service is used.

## Requirements

- Windows 10 or later for the desktop app
- Node.js LTS (22 or later) and npm
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload, including MSVC C++ build tools and a Windows 10/11 SDK (needed to rebuild `better-sqlite3` for Electron)
- Android Studio with Android SDK 35 and JDK 17
- Phone and desktop connected to the same Wi-Fi/LAN

## Desktop app

1. Open a terminal in `desktop/` and install the dependencies:

   ```powershell
   cd desktop
   npm install
   ```

2. Start the development app:

   ```powershell
   npm start
   ```

   The desktop HTTP API listens on `0.0.0.0:3000`. Closing the checklist window hides the app in the system tray; choose **Quit** from the tray menu to exit it.

3. Build the Windows NSIS installer:

   ```powershell
   Set-Location cd desktop
   npm run build
   ```

   Run this from the `desktop/` project directory, not from its `build/` output directory. If `npm run build` reports that it cannot find Visual Studio, open **Visual Studio Installer**, choose **Modify** for Visual Studio Build Tools, install **Desktop development with C++** (including an MSVC toolset and Windows SDK), then open a new terminal and rerun the command.

   The installer is written under `desktop/build/`. Packaging and the desktop window/tray use the supplied `taskdrop_icon.png` from the workspace root; electron-builder converts the PNG to the Windows icon format during packaging.

### Windows firewall

Allow inbound TCP port **3000** on the **Private** network profile. For example, from an elevated PowerShell prompt:

```powershell
New-NetFirewallRule -DisplayName "TaskDrop LAN" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Only allow this port on a trusted home network. To remove the rule later:

```powershell
Remove-NetFirewallRule -DisplayName "TaskDrop LAN"
```

Find the desktop's current LAN IPv4 address with `ipconfig`. The phone's default address is `XXX.XXX.XX.XXX:3000`; use the gear icon in the phone app to change it if DHCP assigns a different address.

## Android phone app

1. Open the `phone/` directory in Android Studio and allow Gradle sync to install the configured Android/Kotlin dependencies.
2. Select a connected Android 12+ phone (API 31 or later) in Android Studio and press **Run** to build and install the app. Alternatively, build from the `phone/` directory:

   ```powershell
   .\gradlew.bat assembleDebug
   ```

   `assembleDebug` only creates the APK; it does not install it. To install the built APK, enable USB debugging on the phone, connect it, accept its debugging prompt, then run these commands from `phone/`:

   ```powershell
   adb devices
   adb install -r .\app\build\outputs\apk\debug\app-debug.apk
   ```

   The first command should list the phone as `device` (not `unauthorized`). If PowerShell cannot find `adb`, run it from Android Studio's Terminal or use the `adb.exe` under your Android SDK's `platform-tools` directory. After installation, open **TaskDrop** from the phone's app list.

3. In the phone app, use the gear icon to set the desktop's LAN address if needed. Type a task or tap the microphone and grant audio permission. The optional **Non-skippable** checkbox shows an always-on-top desktop reminder until that item is completed. Drag the **DRAG TO MOVE** bar at the top to reposition the reminder.

If Android Studio reports `Unknown command-line option '--jvm-vendor'`, its Gradle launch is using a JVM-selection option unsupported by the configured Gradle version. In **Settings > Build, Execution, Deployment > Build Tools > Gradle**, set **Gradle distribution** to use the project's wrapper and set **Gradle JDK** to JDK 17, then sync again. The command-line build can still succeed because it invokes the wrapper directly.

The phone retries queued tasks at launch, after sending, and every 30 seconds while the app is in the foreground. Queued tasks remain on the phone if the desktop is unreachable.

## API

- `GET /health` — desktop server health
- `POST /items` — receive a task; repeated `(text, created_at)` submissions are idempotent
- `GET /items` — return the checklist for future clients

## Validation

Desktop API tests use Node's built-in test runner:

```powershell
cd desktop
npm test
```

The Android project targets SDK 35 and includes its Gradle wrapper configuration. LAN behavior should be verified with the desktop running, an inbound firewall rule enabled, and a phone on the same Wi-Fi network.

## Future work (v2)

- Two-way sync (phone fetches the desktop checklist)
- Categories, due dates, and subtasks
- mDNS desktop discovery
- Multiple phones
- Authentication and encryption
- Push notifications
- Cloud relay

# Building APK for Voting App

## Option 1: EAS Build (Cloud - Recommended) ⭐

This is the easiest method and doesn't require Android Studio installation.

### Steps:

1. **Login to Expo** (first time only):
   ```bash
   npx eas-cli login
   ```

2. **Build the APK**:
   ```bash
   npx eas-cli build --platform android --profile preview
   ```
   
   Or for production build:
   ```bash
   npx eas-cli build --platform android --profile production
   ```

3. **Download the APK**: After the build completes, you'll get a download link. The APK will be available in your Expo dashboard.

**Note**: EAS Build requires a free Expo account. Sign up at https://expo.dev if you don't have one.

---

## Option 2: Local Build

This requires Android Studio to be installed.

### Prerequisites:

1. **Install Android Studio**:
   - Download from: https://developer.android.com/studio
   - During installation, make sure to install Android SDK

2. **Find your Android SDK path**:
   - Windows default: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`
   - Or check Android Studio: File → Settings → Appearance & Behavior → System Settings → Android SDK

3. **Update `android/local.properties`**:
   - Open `android/local.properties`
   - Update the `sdk.dir` path to your actual Android SDK location
   - Example: `sdk.dir=C:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk`

### Build Steps:

1. **Build the APK**:
   ```bash
   cd android
   .\gradlew.bat assembleRelease
   ```

2. **Find your APK**:
   - Location: `android/app/build/outputs/apk/release/app-release.apk`

---

## Quick Start (EAS Build)

If you want to build right now without installing Android Studio:

```bash
# Login (if not already logged in)
npx eas-cli login

# Build APK
npx eas-cli build --platform android --profile preview
```

The APK will be ready in a few minutes and you'll get a download link!


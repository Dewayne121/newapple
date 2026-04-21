# TestFlight Upload Guide — UNYIELDING

## One-liner for future Claude sessions
> "Upload the app to TestFlight using the guide on my Desktop"

## What this app is
- **App name**: UNYIELDING (bundle ID: `com.unyielding.app`)
- **Framework**: Expo / React Native (managed workflow)
- **App Store Connect ID**: 6761363919

## Apple Developer Account
- **Team ID**: `4DHULG8MBZ`
- **Apple ID**: `hopingom@yahoo.co.uk`

## App Store Connect API Key
- **Key ID**: `MTT724K6AT`
- **Issuer ID**: `2baaf2d7-2aee-487d-85e8-408adf09355d`
- **File**: `AuthKey_MTT724K6AT.p8` (copy on Desktop)
- **Role**: Admin (can upload builds but CANNOT create new apps)

## Tools installed
- **Node.js**: `/opt/homebrew/bin/node` (add to PATH)
- **npm**: `/opt/homebrew/bin/npm`
- **EAS CLI**: installed globally
- **fastlane**: installed via Homebrew (`/opt/homebrew/bin/fastlane`)
- **CocoaPods**: installed via Homebrew

## Step-by-step process

### 1. Pull latest code (if using git)
```bash
cd ~/Desktop/<project-folder>
git pull origin master
```

### 2. Install dependencies
```bash
export PATH="/opt/homebrew/bin:$PATH"
npm install
```

### 3. Prebuild native iOS project
```bash
npx expo prebuild --platform ios --clean
```

### 4. After prebuild, fix these files:

**a) Bump build number** in `ios/UNYIELDING/Info.plist`:
- Change `CFBundleVersion` from `1` to the next build number (increment each time)
- Current build was 3, so next is 4, then 5, etc.

**b) Fix entitlements** in `ios/UNYIELDING/UNYIELDING.entitlements`:
- Change `aps-environment` from `development` to `production`

**c) Copy API key** to `ios/fastlane/AuthKey_MTT724K6AT.p8`:
```bash
mkdir -p ios/fastlane
```
Then use Finder (AppleScript) to copy from Desktop:
```bash
osascript -e 'tell application "Finder" to copy file "AuthKey_MTT724K6AT.p8" of desktop to folder "fastlane" of folder "ios" of folder "<project-folder>" of desktop'
```
Verify it's 257 bytes (not 74 — that's a corrupted copy).

**d) Create Fastfile** at `ios/fastlane/Fastfile`:
```ruby
default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    api_key = app_store_connect_api_key(
      key_id: "MTT724K6AT",
      issuer_id: "2baaf2d7-2aee-487d-85e8-408adf09355d",
      key_filepath: "fastlane/AuthKey_MTT724K6AT.p8",
      duration: 1200,
      in_house: false
    )
    get_certificates(api_key: api_key)
    sigh(
      api_key: api_key,
      app_identifier: "com.unyielding.app",
      force: true
    )
    profile_uuid = lane_context[SharedValues::SIGH_UUID]
    build_app(
      scheme: "UNYIELDING",
      archive_path: "./build/UNYIELDING.xcarchive",
      export_method: "app-store",
      xcargs: "CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=4DHULG8MBZ CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER='#{profile_uuid}'"
    )
    upload_to_testflight(
      api_key: api_key,
      app_identifier: "com.unyielding.app"
    )
  end
end
```

### 5. Run the build + upload
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd ios
fastlane beta
```

This handles everything: certificates, provisioning profiles, archive, export, upload to TestFlight, and distribution to internal testers.

## Timing
- Build: ~2 minutes
- Upload + processing: ~5-10 minutes
- Total: ~6-12 minutes

## Known issues / gotchas
- **macOS file permissions**: Terminal can't read Desktop files directly. Use `osascript`/Finder to copy the .p8 key file.
- **Push notifications**: The entitlements file always resets to `development` after prebuild. Must change to `production` each time.
- **Build number**: Always resets to `1` after prebuild. Must bump manually.
- **EAS CLI**: Causes Apple account lockouts from repeated sign-ins. Use local fastlane builds instead.
- **App creation**: API key cannot create new apps on App Store Connect. Must be done manually at appstoreconnect.apple.com.
- **fastlane `produce`/`deliver`**: Don't support `api_key` parameter for app creation. Only `upload_to_testflight` and `sigh`/`get_certificates` work with API keys.
- **Node.js PATH**: Must export `/opt/homebrew/bin:$PATH` before any commands.

## File locations
- API key on Desktop: `~/Desktop/AuthKey_MTT724K6AT.p8`
- IPA output: `<project>/ios/UNYIELDING.ipa`
- Build logs: `~/Library/Logs/gym/UNYIELDING-UNYIELDING.log`

# Passt das von Capacitor erzeugte Xcode-Projekt an. Läuft im iOS-Workflow
# nach „npx cap add ios“ und „npx cap sync ios“:
#
#   ruby tools/ios-setup.rb
#
# Umgebungsvariablen:
#   MARKETING_VERSION        Version aus index.html (APP_VERSION), z. B. 2.4
#   CURRENT_PROJECT_VERSION  Build-Nummer, muss bei jedem Upload steigen
#   TEAM_ID, PROFILE_NAME    nur für den signierten Build
#
# Warum Ruby: Das Gem „xcodeproj“ (Teil von CocoaPods, auf den macOS-Läufern
# vorhanden) ändert die Projektdatei sicher. Ein sed auf project.pbxproj
# würde auch die Swift-Pakete treffen, und die vertragen keine Signierung.
begin
  require 'xcodeproj'
rescue LoadError
  system('gem install --user-install xcodeproj') or abort('xcodeproj fehlt')
  Gem.clear_paths
  require 'xcodeproj'
end

APP_ID = 'de.maehlmann.todoorganizer'
projekt = Xcodeproj::Project.open('ios/App/App.xcodeproj')
ziel = projekt.targets.find { |t| t.name == 'App' } or abort('Ziel „App“ fehlt')

# Privacy-Manifest als Ressource der App einbinden (die Vorlage hat keins).
gruppe = projekt.main_group.find_subpath('App', false) or abort('Gruppe „App“ fehlt')
ref = gruppe.files.find { |f| f.path == 'PrivacyInfo.xcprivacy' } ||
      gruppe.new_reference('PrivacyInfo.xcprivacy')
unless ziel.resources_build_phase.files_references.include?(ref)
  ziel.resources_build_phase.add_file_reference(ref, true)
end

signieren = ENV['TEAM_ID'].to_s != '' && ENV['PROFILE_NAME'].to_s != ''
ziel.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = APP_ID
  s['TARGETED_DEVICE_FAMILY'] = '1'          # nur iPhone, siehe PROJEKTWISSEN.md
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'   # StoreKit 2 braucht iOS 15
  s['MARKETING_VERSION'] = ENV['MARKETING_VERSION'] if ENV['MARKETING_VERSION'].to_s != ''
  s['CURRENT_PROJECT_VERSION'] = ENV['CURRENT_PROJECT_VERSION'] if ENV['CURRENT_PROJECT_VERSION'].to_s != ''
  if signieren && c.name == 'Release'
    s['CODE_SIGN_STYLE'] = 'Manual'
    s['DEVELOPMENT_TEAM'] = ENV['TEAM_ID']
    s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
    s['PROVISIONING_PROFILE_SPECIFIER'] = ENV['PROFILE_NAME']
  end
end

projekt.save
puts "Xcode-Projekt angepasst (Version #{ENV['MARKETING_VERSION']}, Build #{ENV['CURRENT_PROJECT_VERSION']}, signiert: #{signieren})"

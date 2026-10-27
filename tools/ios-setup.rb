# Passt das von Capacitor erzeugte Xcode-Projekt an. Läuft im iOS-Workflow
# nach „npx cap add ios“ und „npx cap sync ios“:
#
#   ruby tools/ios-setup.rb
#
# Umgebungsvariablen:
#   MARKETING_VERSION        Version aus index.html (APP_VERSION), z. B. 2.4
#   CURRENT_PROJECT_VERSION  Build-Nummer, muss bei jedem Upload steigen
#   TEAM_ID, PROFILE_NAME    nur für den signierten Build
#   WIDGET=1                 Heute-Widget mitbauen (Erweiterung + App-Gruppe);
#                            die Brücke (WidgetDataPlugin) und Schnellaktionen
#                            kommen immer ins Projekt
#   WIDGET_PROFILE_NAME      Profil des Widgets (de.maehlmann.todoorganizer.widget)
#
# Die Dateien (res/ios/app, res/ios/widget) kopiert der Workflow vorher nach
# ios/App/App bzw. ios/App/TodayWidget – SceneDelegate.swift ersetzt dabei
# die Vorlage von Capacitor (Schnellaktionen).
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
  s['TARGETED_DEVICE_FAMILY'] = '1,2'        # iPhone und iPad, siehe PROJEKTWISSEN.md
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

# ---- Brücke zu iOS (Widget-Daten, Schnellaktionen) – immer ---------------------
# Capacitor meldet Plugins über „packageClassList“ in capacitor.config.json an.
# Ein eigener Startbildschirm im Storyboard hilft in Capacitor 8 NICHT: Der
# SceneDelegate erzeugt CAPBridgeViewController im Code, das Storyboard bleibt
# unbenutzt (deshalb kam das Widget bis Build 3.1 ohne Daten).
r = gruppe.files.find { |x| x.path == 'WidgetDataPlugin.swift' } || gruppe.new_reference('WidgetDataPlugin.swift')
ziel.source_build_phase.add_file_reference(r, true) unless ziel.source_build_phase.files_references.include?(r)
require 'json'
cfg_pfad = 'ios/App/App/capacitor.config.json'
cfg = JSON.parse(File.read(cfg_pfad))
cfg['packageClassList'] = (cfg['packageClassList'] || []) | ['WidgetDataPlugin']
File.write(cfg_pfad, JSON.pretty_generate(cfg) + "\n")

# ---- Heute-Widget ---------------------------------------------------------------
widget = ENV['WIDGET'] == '1'
if widget
  WIDGET_ID = APP_ID + '.widget'
  # 1 · App-Gruppe für die App
  gruppe.files.find { |x| x.path == 'App.entitlements' } || gruppe.new_reference('App.entitlements')
  ziel.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements' }

  # 2 · Widget-Erweiterung als eigenes Ziel
  wz = projekt.targets.find { |t| t.name == 'TodayWidget' } ||
       projekt.new_target(:app_extension, 'TodayWidget', :ios, '15.0', nil, :swift)
  wg = projekt.main_group.find_subpath('TodayWidget', true)
  wg.set_source_tree('<group>'); wg.set_path('TodayWidget')
  quelle = wg.files.find { |x| x.path == 'TodayWidget.swift' } || wg.new_reference('TodayWidget.swift')
  wz.source_build_phase.add_file_reference(quelle, true) unless wz.source_build_phase.files_references.include?(quelle)
  priv = wg.files.find { |x| x.path == 'PrivacyInfo.xcprivacy' } || wg.new_reference('PrivacyInfo.xcprivacy')
  wz.resources_build_phase.add_file_reference(priv, true) unless wz.resources_build_phase.files_references.include?(priv)
  %w[Info.plist TodayWidget.entitlements].each { |f| wg.files.find { |x| x.path == f } || wg.new_reference(f) }

  wz.build_configurations.each do |c|
    s = c.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = WIDGET_ID
    s['PRODUCT_NAME'] = 'TodayWidget'
    s['INFOPLIST_FILE'] = 'TodayWidget/Info.plist'
    s['GENERATE_INFOPLIST_FILE'] = 'NO'
    s['CODE_SIGN_ENTITLEMENTS'] = 'TodayWidget/TodayWidget.entitlements'
    s['SWIFT_VERSION'] = '5.0'
    s['TARGETED_DEVICE_FAMILY'] = '1,2'
    s['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
    s['SKIP_INSTALL'] = 'YES'
    s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
    s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
    # Version und Build müssen exakt zur App passen, sonst lehnt der Upload ab
    s['MARKETING_VERSION'] = ENV['MARKETING_VERSION'] if ENV['MARKETING_VERSION'].to_s != ''
    s['CURRENT_PROJECT_VERSION'] = ENV['CURRENT_PROJECT_VERSION'] if ENV['CURRENT_PROJECT_VERSION'].to_s != ''
    if signieren && c.name == 'Release'
      abort('WIDGET_PROFILE_NAME fehlt') if ENV['WIDGET_PROFILE_NAME'].to_s == ''
      s['CODE_SIGN_STYLE'] = 'Manual'
      s['DEVELOPMENT_TEAM'] = ENV['TEAM_ID']
      s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
      s['PROVISIONING_PROFILE_SPECIFIER'] = ENV['WIDGET_PROFILE_NAME']
    end
  end

  # 3 · In die App einbetten (PlugIns) und vorher bauen
  ziel.add_dependency(wz) unless ziel.dependencies.any? { |d| d.target == wz }
  phase = ziel.copy_files_build_phases.find { |b| b.name == 'Embed Foundation Extensions' } ||
          ziel.new_copy_files_build_phase('Embed Foundation Extensions')
  phase.symbol_dst_subfolder_spec = :plug_ins
  unless phase.files_references.include?(wz.product_reference)
    bf = phase.add_file_reference(wz.product_reference, true)
    bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  end
end

projekt.save
puts "Heute-Widget: #{widget ? 'eingebaut' : 'nicht eingebaut'}"
puts "Xcode-Projekt angepasst (Version #{ENV['MARKETING_VERSION']}, Build #{ENV['CURRENT_PROJECT_VERSION']}, signiert: #{signieren})"

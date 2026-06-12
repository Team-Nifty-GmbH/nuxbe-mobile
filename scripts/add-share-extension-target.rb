#!/usr/bin/env ruby
# One-shot script: adds the NuxbeShare share extension target to the Xcode
# project. Idempotent - exits if the target already exists.

require 'xcodeproj'

project_path = File.expand_path('../ios/App/App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

if project.targets.any? { |t| t.name == 'NuxbeShare' }
  puts 'NuxbeShare target already exists - nothing to do'
  exit 0
end

app_target = project.targets.find { |t| t.name == 'App' } or abort 'App target not found'
deployment_target = app_target.build_configurations.first.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '15.0'

extension = project.new_target(:app_extension, 'NuxbeShare', :ios, deployment_target)

# File references under a NuxbeShare group
group = project.main_group.new_group('NuxbeShare', 'NuxbeShare')
swift_ref = group.new_reference('ShareViewController.swift')
group.new_reference('Info.plist')
group.new_reference('NuxbeShare.entitlements')

extension.source_build_phase.add_file_reference(swift_ref)

extension.build_configurations.each do |config|
  settings = config.build_settings
  settings['PRODUCT_NAME'] = 'NuxbeShare'
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.teamnifty.nuxbe.share'
  settings['INFOPLIST_FILE'] = 'NuxbeShare/Info.plist'
  settings['CODE_SIGN_ENTITLEMENTS'] = 'NuxbeShare/NuxbeShare.entitlements'
  settings['SWIFT_VERSION'] = '5.0'
  settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = deployment_target
  settings['MARKETING_VERSION'] = '$(inherited)'
  settings['CURRENT_PROJECT_VERSION'] = '$(inherited)'
  settings['DEVELOPMENT_TEAM'] = 'YS428GD6FU'
  settings['CODE_SIGN_STYLE'] = 'Manual'
  settings['SKIP_INSTALL'] = 'YES'
end

# Embed the extension into the app
embed_phase = app_target.build_phases.find do |phase|
  phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
    phase.symbol_dst_subfolder_spec == :plug_ins
end
embed_phase ||= app_target.new_copy_files_build_phase('Embed Foundation Extensions').tap do |phase|
  phase.symbol_dst_subfolder_spec = :plug_ins
end

build_file = embed_phase.add_file_reference(extension.product_reference)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

app_target.add_dependency(extension)

project.save
puts 'NuxbeShare target added'

# encoding: UTF-8
require 'sketchup.rb'
require 'extensions.rb'
unless file_loaded?(__FILE__)
  extension=SketchupExtension.new('智碳','zhitan/main')
  extension.description='太阳辐射与多层构造分析开发预览。专业引擎与版本兼容仍待实机验证。'
  extension.version='0.1.0'
  extension.creator='智碳'
  Sketchup.register_extension(extension,true)
  file_loaded(__FILE__)
end

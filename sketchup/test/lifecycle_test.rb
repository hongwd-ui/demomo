# encoding: UTF-8
require 'minitest/autorun'
require 'minitest/mock'
require 'tmpdir'
$LOAD_PATH.unshift(File.join(__dir__,'support'))
require_relative '../zhitan/main'
class HostModel
  def initialize;@attributes={};end
  def guid;'model-1';end
  def valid?;true;end
  def entities;[];end
  def add_observer(_observer);end
  def remove_observer(_observer);end
  def materials;self;end
  def get_attribute(_dictionary,key,default=nil);@attributes.fetch(key,default);end
  def set_attribute(_dictionary,key,value);@attributes[key]=value;end
  def start_operation(*_args);end
  def commit_operation;end
  def abort_operation;end
end
class LifecycleTest < Minitest::Test
  def setup
    @dir=Dir.mktmpdir
    UI.save_path=File.join(@dir,'scene.json');UI.messages=[];UI.open_count=0
    Sketchup.active_model=HostModel.new
    File.stub(:file?,true){Zhitan.show}
  end
  def teardown
    UI.last_dialog.close if UI.last_dialog.visible?
    FileUtils.remove_entry(@dir)
  end
  def call_host(type,payload={})
    Zhitan.dispatch(JSON.generate({'protocol_version'=>1,'request_id'=>'r1','type'=>type,'model_id'=>'model-1','scene_revision'=>0,'payload'=>payload}))
    encoded=UI.last_dialog.scripts.last.match(/JSON.parse\((.*)\)\)/)[1]
    JSON.parse(JSON.parse(encoded))
  end
  def test_closed_panel_cannot_import_cached_scene
    call_host('scene.export',{'selection_only'=>false})
    UI.last_dialog.close
    Zhitan.import_result
    assert_equal 0,UI.open_count
    assert UI.messages.last.include?('请先从当前模型导出')
  end
  def test_reopening_does_not_reuse_scene_revision
    before=call_host('scene.export')['scene_revision']
    UI.last_dialog.close
    File.stub(:file?,true){Zhitan.show}
    after=call_host('scene.export')['scene_revision']
    assert after>before
  end
  def test_saved_host_construction_is_returned_on_reopen
    construction={'id'=>'own-wall','name'=>'持久构造','kind'=>'opaque_series','source'=>'测试',
      'rsi_m2k_w'=>0.1,'rse_m2k_w'=>0.05,'materials'=>[{'id'=>'m','name'=>'材料','conductivity_w_mk'=>1}],
      'layers'=>[{'material_id'=>'m','thickness_m'=>0.2}]}
    assert_equal 'construction.save',call_host('construction.save',{'construction'=>construction})['type']
    UI.last_dialog.close
    File.stub(:file?,true){Zhitan.show}
    assert_equal construction,call_host('host.capabilities')['payload']['saved_construction']
  end
end

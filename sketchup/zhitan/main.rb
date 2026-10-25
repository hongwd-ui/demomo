# encoding: UTF-8
require 'sketchup.rb'
require 'json'
require_relative 'construction'
require_relative 'exporter'
require_relative 'observers'
require_relative 'visualization'
module Zhitan
  UI_FILE=File.join(__dir__,'ui','index.html').freeze
  def self.bind_model(model)
    UI.stop_timer(@timer) if @timer
    Visualization.clear
    @timer=nil;@model=model;@revision=(@revision||0)+1;@last_scene=nil
    Observers.attach(model)
    @dialog.execute_script('window.dispatchEvent(new CustomEvent("zhitan:model-changed"))') if @dialog&&@dialog.visible?
  end
  def self.changed(model)
    return unless @model==model
    @revision=(@revision||0)+1
    @last_scene=nil
    UI.stop_timer(@timer) if @timer
    @timer=UI.start_timer(0.5,false) do
      @timer=nil
      Visualization.clear
      # Invalidation is observable; automatic recomputation is not implemented yet.
      @dialog.execute_script('window.dispatchEvent(new CustomEvent("zhitan:scene-invalidated"))') if @dialog&&@dialog.visible?
    end
  end
  def self.send_response(request,type,payload)
    response={'protocol_version'=>1,'request_id'=>request.fetch('request_id','invalid'),'type'=>type,
      'model_id'=>Sketchup.active_model.guid,'scene_revision'=>@revision||0,'payload'=>payload}
    encoded=JSON.generate(JSON.generate(response),ascii_only: true)
    @dialog.execute_script("window.ZhitanBridge && window.ZhitanBridge.receive(JSON.parse(#{encoded}))")
  end
  def self.dispatch(raw)
    request={}
    raise ArgumentError,'消息过大' unless raw.is_a?(String)&&raw.bytesize<=1048576
    request=JSON.parse(raw)
    raise ArgumentError,'协议无效' unless request.is_a?(Hash)&&request['protocol_version']==1&&request['request_id'].is_a?(String)&&!request['request_id'].empty?&&request['payload'].is_a?(Hash)
    model=Sketchup.active_model;bind_model(model) if @model!=model
    case request['type']
    when 'host.capabilities'
      saved=JSON.parse(model.get_attribute('zhitan','constructions_json','{}'))
      last_id=model.get_attribute('zhitan','last_construction_id',nil)
      construction=saved[last_id]||saved.values.first
      Construction.validate!(construction) if construction
      send_response(request,request['type'],{'sketchup_version'=>Sketchup.version,'engine_connected'=>false,'algorithms'=>[],'compatibility_verified'=>false,'saved_construction'=>construction})
    when 'construction.save'
      construction=Construction.validate!(request['payload']['construction'])
      saved=JSON.parse(model.get_attribute('zhitan','constructions_json','{}'))
      saved[construction['id']]=construction
      model.start_operation('保存智碳构造',true)
      begin
        model.set_attribute('zhitan','constructions_json',JSON.generate(saved))
        model.set_attribute('zhitan','last_construction_id',construction['id']);model.commit_operation
      rescue StandardError
        model.abort_operation;raise
      end
      send_response(request,request['type'],{'construction'=>construction})
    when 'scene.export'
      scene=Exporter.export(model,selection_only: request['payload']['selection_only']==true,revision: @revision||0)
      path=UI.savepanel('导出智碳场景 JSON',nil,'scene.json')
      raise ArgumentError,'导出已取消' unless path
      File.open(path,'w:UTF-8'){|file|file.write(JSON.generate(scene))}
      @last_scene=scene
      send_response(request,request['type'],{'surface_count'=>scene['surfaces'].length,'diagnostics'=>scene['diagnostics']})
    else
      raise ArgumentError,'该功能尚未实现'
    end
  rescue StandardError => error
    request={} unless request.is_a?(Hash)
    safe_message=error.is_a?(ArgumentError) ? error.message : '操作失败，请检查模型或文件写入权限'
    send_response(request,'request.error',{'code'=>'HOST_REQUEST_FAILED','message'=>safe_message,'retryable'=>false})
  end
  def self.import_result
    unless @last_scene
      UI.messagebox('请先从当前模型导出场景 JSON，再用独立直射计算服务计算。');return
    end
    path=UI.openpanel('导入直射预览结果',nil,'JSON 文件|*.json||')
    return unless path
    raise ArgumentError,'结果文件超过 64 MiB' if File.size(path)>67108864
    result=JSON.parse(File.read(path,encoding:'UTF-8'))
    Visualization.show(Sketchup.active_model,@last_scene,result,{'model_id'=>Sketchup.active_model.guid,'scene_revision'=>@revision||0})
    UI.messagebox('当前仅显示不透明遮挡下的单点直射预览，不含天空散射、反射、玻璃透射或完整能耗。色带按本次最大值归一化。')
  rescue StandardError
    UI.messagebox('无法导入。请确认结果格式、单位与当前模型版本一致，并检查宿主绘制能力。')
  end
  def self.show
    if @dialog&&@dialog.visible?;@dialog.bring_to_front;return;end
    unless File.file?(UI_FILE);UI.messagebox('界面未打包。请先运行 npm run package:sketchup 并安装生成的 RBZ。');return;end
    bind_model(Sketchup.active_model)
    @dialog=UI::HtmlDialog.new(dialog_title:'智碳 · 建筑性能分析',preferences_key:'zhitan.workspace',width:1200,height:900,resizable:true)
    @dialog.add_action_callback('zhitan_request'){|_context,raw|dispatch(raw)}
    @dialog.set_on_closed do
      Observers.detach
      @last_scene=nil;@revision=(@revision||0)+1
      Visualization.clear
      UI.stop_timer(@timer) if @timer
      @timer=nil;@dialog=nil
    end
    @dialog.set_file(UI_FILE);@dialog.show
  end
  unless file_loaded?(__FILE__)
    menu=UI.menu('Extensions').add_submenu('智碳')
    menu.add_item('打开工作台'){show}
    menu.add_item('导入直射预览结果'){import_result}
    menu.add_item('清除分析显示'){Visualization.clear}
    @app_observer=Observers::Application.new
    Sketchup.add_observer(@app_observer)
    file_loaded(__FILE__)
  end
end

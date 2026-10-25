# encoding: UTF-8
module Zhitan
  module Visualization
    def self.prepare(scene,result,current)
      unless [scene,result].all?{|data|data['model_id']==current['model_id']&&data['scene_revision']==current['scene_revision']}
        raise ArgumentError,'结果不属于当前模型版本，请重新导出并计算'
      end
      unless result['quality']=='direct_preview'&&result['metric']=='incident_irradiance'&&result['unit']=='W_m2'
        raise ArgumentError,'仅支持 W/m² 的直射预览结果'
      end
      triangles=scene['surfaces'].flat_map{|surface|surface['triangles'].map{|t|[surface['id'],t]}}
      samples=result['samples'];raise ArgumentError,'采样点数不匹配' unless samples.is_a?(Array)&&samples.length==triangles.length
      raise ArgumentError,'无有效采样' if samples.empty?
      samples.each_with_index do |sample,i|
        id,triangle=triangles[i]
        centroid=(0..2).map{|axis|triangle.inject(0.0){|sum,p|sum+p[axis]}/3}
        p=sample['position_m'];v=sample['value']
        unless sample['surface_id']==id&&v.is_a?(Numeric)&&v.finite?&&v>=0&&p.is_a?(Array)&&p.length==3&&p.all?{|x|x.is_a?(Numeric)&&x.finite?}&&p.zip(centroid).all?{|a,b|(a-b).abs<1e-6}
          raise ArgumentError,'采样身份、位置或数值无效'
        end
      end
      maximum=[samples.map{|s|s['value']}.max,1].max
      angle=scene['north_rotation_deg']*Math::PI/180.0;origin=scene.fetch('origin_model_inches',[0,0,0])
      triangles.each_with_index.map do |(_id,triangle),i|
        fraction=samples[i]['value']/maximum.to_f
        color=[(75+170*fraction).round,(155-75*fraction).round,(130-75*fraction).round]
        points=triangle.map do |x,y,z|
          [(Math.cos(angle)*x+Math.sin(angle)*y)/0.0254+origin[0],(-Math.sin(angle)*x+Math.cos(angle)*y)/0.0254+origin[1],z/0.0254+origin[2]]
        end
        {'points'=>points,'color'=>color,'value'=>samples[i]['value']}
      end
    end
    def self.show(model,scene,result,current)
      patches=prepare(scene,result,current)
      clear
      draw=proc do |view|
        patches.each do |patch|
          color=Sketchup::Color.new(*patch['color']);color.alpha=180;view.drawing_color=color
          view.draw(GL_TRIANGLES,patch['points'].map{|p|Geom::Point3d.new(*p)})
        end
      end
      @model=model
      if defined?(Sketchup::Overlay)&&model.respond_to?(:overlays)
        klass=Class.new(Sketchup::Overlay) do
          define_method(:initialize){super('zhitan.direct_preview','智碳 · 仅直射预览')}
          define_method(:draw,&draw)
        end
        @overlay=klass.new;model.overlays.add(@overlay)
      else
        tool_class=Class.new do
          define_method(:draw,&draw)
          define_method(:onCancel){|_reason,_view|Zhitan::Visualization.clear}
        end
        @tool=tool_class.new;model.tools.push_tool(@tool)
      end
      model.active_view.invalidate
    end
    def self.clear
      model=@model;overlay=@overlay;tool=@tool
      @overlay=nil;@tool=nil;@model=nil
      return unless model&&model.valid?
      model.overlays.remove(overlay) if overlay
      model.tools.pop_tool if tool
      model.active_view.invalidate
    end
  end
end

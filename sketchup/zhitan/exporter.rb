# encoding: UTF-8
require 'json'
require_relative 'geometry'
module Zhitan
  module Exporter
    def self.export(model,selection_only: false,revision: 0)
      north=model.get_attribute('zhitan','north_clockwise_deg',nil)
      diagnostics=[]
      diagnostics<<{'code'=>'TRUE_NORTH_UNCONFIRMED','message'=>'真北未确认，临时按模型 +Y；不可据此给出工程结论。'} if north.nil?
      north=Float(north||0);raise ArgumentError,'真北无效' unless north.finite?
      scene={'schema_version'=>1,'model_id'=>model.guid,'scene_revision'=>revision,'coordinate_system'=>'local_enu_m',
        'north_rotation_deg'=>north,'origin_model_inches'=>(model.respond_to?(:bounds) ? model.bounds.center.to_a : [0,0,0]), 'surfaces'=>[],'diagnostics'=>diagnostics}
      transform=Geometry::IDENTITY;path=[]
      if selection_only&&model.active_path
        model.active_path.each{|instance|transform=Geometry.multiply(transform,instance.transformation.to_a);path<<instance.persistent_id.to_s}
      end
      walk(selection_only ? model.selection : model.entities,transform,path,scene)
      scene
    end
    def self.walk(entities,transform,path,scene)
      entities.each do |entity|
        next unless entity.valid?
        next if entity.hidden?||!entity.layer.visible?||entity.get_attribute('zhitan','analysis_result',false)
        if entity.is_a?(Sketchup::Face)
          id=(path+[entity.persistent_id.to_s]).join('/')
          begin
            mesh=entity.mesh(0);triangles=[]
            mesh.polygons.each do |polygon|
              points=polygon.map{|index|mesh.point_at(index.abs).to_a}
              (1...(points.length-1)).each{|i|triangles<<Geometry.triangle([points[0],points[i],points[i+1]],transform,scene['north_rotation_deg'],scene['origin_model_inches'])}
            end
            next if triangles.empty?
            role=entity.get_attribute('zhitan','role','unknown')
            role='unknown' unless %w[wall roof ground window shade obstruction].include?(role)
            scene['surfaces']<<{'id'=>id,'role'=>role,'construction_id'=>entity.get_attribute('zhitan','construction_id',nil),
              'triangles'=>triangles,'normal'=>Geometry.normal(triangles.first),'area_m2'=>triangles.inject(0.0){|sum,t|sum+Geometry.area(t)}}
          rescue ArgumentError
            scene['diagnostics']<<{'code'=>'INVALID_GEOMETRY','surface_id'=>id,'message'=>'该面几何无效，已排除；需修复后重算。'}
          end
        elsif entity.respond_to?(:transformation)
          children=entity.is_a?(Sketchup::Group) ? entity.entities : (entity.respond_to?(:definition) ? entity.definition.entities : nil)
          walk(children,Geometry.multiply(transform,entity.transformation.to_a),path+[entity.persistent_id.to_s],scene) if children
        end
      end
    end
  end
end

# encoding: UTF-8
require 'minitest/autorun'
require_relative '../zhitan/exporter'
# Host-shaped doubles test traversal logic only; these are not SketchUp SDK validation.
module Sketchup
  class Face
    attr_reader :persistent_id, :attributes
    def initialize(id,points);@persistent_id=id;@points=points;@attributes={};end
    def hidden?;false;end
    def layer;Struct.new(:visible?).new(true);end
    def valid?;true;end
    def get_attribute(_dictionary,key,default=nil);@attributes.fetch(key,default);end
    def material;nil;end
    def mesh(_flags);points=@points;Object.new.tap{|m|m.define_singleton_method(:polygons){[[1,2,3]]};m.define_singleton_method(:point_at){|i|points[i-1]}};end
  end
  class Group
    attr_reader :persistent_id,:entities,:transformation
    def initialize(id,entities,transform=Zhitan::Geometry::IDENTITY);@persistent_id=id;@entities=entities;@transformation=transform;end
    def valid?;true;end
    def hidden?;false;end
    def layer;Struct.new(:visible?).new(true);end
    def get_attribute(_dictionary,_key,default=nil);default;end
  end
end
class ExportContractTest < Minitest::Test
  def model(entities)
    Object.new.tap do |m|
      m.define_singleton_method(:entities){entities}
      m.define_singleton_method(:selection){entities}
      m.define_singleton_method(:active_path){nil}
      m.define_singleton_method(:guid){'fixture-model'}
      m.define_singleton_method(:get_attribute){|_d,_k,default=nil|default}
    end
  end
  def face;Sketchup::Face.new(1,[[0,0,0],[40,0,0],[0,40,0]]);end
  def test_shared_face_instances_have_distinct_surface_ids
    f=face;scene=Zhitan::Exporter.export(model([Sketchup::Group.new(10,[f]),Sketchup::Group.new(20,[f])]))
    assert_equal ['10/1','20/1'],scene['surfaces'].map{|s|s['id']}
    assert_equal 'local_enu_m',scene['coordinate_system']
    assert scene['diagnostics'].any?{|d|d['code']=='TRUE_NORTH_UNCONFIRMED'}
  end
  def test_large_coordinates_are_rebased_to_local_metres
    f=Sketchup::Face.new(1,[[1000,1000,0],[1040,1000,0],[1000,1040,0]])
    m=model([f]);m.define_singleton_method(:bounds){Struct.new(:center).new([1000,1000,0])}
    scene=Zhitan::Exporter.export(m)
    assert_equal [1000,1000,0],scene['origin_model_inches']
    assert_equal [0.0,0.0,0.0],scene['surfaces'][0]['triangles'][0][0]
  end
  def test_analysis_results_are_excluded
    group=Sketchup::Group.new(10,[face]);group.define_singleton_method(:get_attribute){|_d,key,default=nil|key=='analysis_result' ? true : default}
    assert_empty Zhitan::Exporter.export(model([group]))['surfaces']
  end
  def test_degenerate_faces_are_diagnosed_not_silently_accepted
    f=Sketchup::Face.new(1,[[0,0,0],[0,0,0],[1,0,0]])
    scene=Zhitan::Exporter.export(model([f]))
    assert_empty scene['surfaces']
    assert_equal 'INVALID_GEOMETRY',scene['diagnostics'].last['code']
  end
  def test_role_is_unknown_until_explicitly_marked
    f=face
    assert_equal 'unknown',Zhitan::Exporter.export(model([f]))['surfaces'][0]['role']
    f.attributes['role']='wall'
    assert_equal 'wall',Zhitan::Exporter.export(model([f]))['surfaces'][0]['role']
  end
end

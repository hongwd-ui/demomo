# encoding: UTF-8
require 'minitest/autorun'
require_relative '../zhitan/geometry'
require_relative '../zhitan/construction'
class GeometryTest < Minitest::Test
  IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1].freeze
  def test_inches_become_metres
    assert_in_delta 1.0, Zhitan::Geometry.point([39.37007874015748,0,0], IDENTITY, 0)[0], 1e-10
  end
  def test_north_clockwise_from_model_y_becomes_enu_north
    point = Zhitan::Geometry.point([10,0,0], IDENTITY, 90)
    assert_in_delta 0, point[0], 1e-10
    assert_in_delta 0.254, point[1], 1e-10
  end
  def test_mirror_changes_winding_without_reversing_outward_normal
    mirror = [-1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
    triangle = Zhitan::Geometry.triangle([[0,0,0],[40,0,0],[0,40,0]], mirror, 0)
    assert Zhitan::Geometry.normal(triangle)[2] > 0
  end
  def test_nonuniform_scale_preserves_correct_area
    scale = [2,0,0,0, 0,3,0,0, 0,0,1,0, 0,0,0,1]
    triangle = Zhitan::Geometry.triangle([[0,0,0],[1,0,0],[0,1,0]], scale, 0)
    assert_in_delta 0.00193548, Zhitan::Geometry.area(triangle), 1e-12
  end
  def test_nested_transforms_apply_parent_to_child
    translated = IDENTITY.dup; translated[12]=10
    scaled = IDENTITY.dup;scaled[0]=2
    combined=Zhitan::Geometry.multiply(translated,scaled)
    assert_in_delta 0.3048,Zhitan::Geometry.point([1,0,0],combined,0)[0],1e-10
  end
  def test_degenerate_triangle_is_rejected
    assert_raises(ArgumentError){Zhitan::Geometry.normal([[0,0,0],[0,0,0],[1,0,0]])}
  end
end
class ConstructionTest < Minitest::Test
  def valid
    {'id'=>'wall','name'=>'墙','source'=>'测试','kind'=>'opaque_series','rsi_m2k_w'=>0.1,'rse_m2k_w'=>0.05,
      'materials'=>[{'id'=>'m','name'=>'材料','conductivity_w_mk'=>1}], 'layers'=>[{'material_id'=>'m','thickness_m'=>0.2}]}
  end
  def test_valid_data_roundtrips
    assert_equal valid, Zhitan::Construction.validate!(valid)
  end
  def test_server_rejects_invalid_and_unsupported_construction
    ['ventilated',nil].each{|kind|assert_raises(ArgumentError){Zhitan::Construction.validate!(valid.merge('kind'=>kind))}}
    [0,-1,'',Float::INFINITY].each do |thickness|
      value=valid;value['layers'][0]['thickness_m']=thickness
      assert_raises(ArgumentError){Zhitan::Construction.validate!(value)}
    end
  end
  def test_unknown_material_reference_is_rejected
    value=valid;value['layers'][0]['material_id']='missing'
    assert_raises(ArgumentError){Zhitan::Construction.validate!(value)}
  end
end

require 'minitest/autorun'
require_relative '../zhitan/visualization'
class VisualizationTest < Minitest::Test
  def scene
    {'model_id'=>'m1','scene_revision'=>2,'north_rotation_deg'=>0,'origin_model_inches'=>[0,0,0],
      'surfaces'=>[{'id'=>'f1','triangles'=>[[[0,0,0],[2,0,0],[0,2,0]]]}]}
  end
  def result
    {'model_id'=>'m1','scene_revision'=>2,'quality'=>'direct_preview','metric'=>'incident_irradiance','unit'=>'W_m2',
      'samples'=>[{'surface_id'=>'f1','position_m'=>[2.0/3,2.0/3,0],'value'=>800}]}
  end
  def test_valid_result_maps_to_model_geometry_without_mutating_scene
    value=scene;original=Marshal.dump(value)
    patches=Zhitan::Visualization.prepare(value,result,{'model_id'=>'m1','scene_revision'=>2})
    assert_equal 1,patches.length
    assert_in_delta 78.7401574803,patches[0]['points'][1][0],1e-8
    assert_equal original,Marshal.dump(value)
  end
  def test_stale_and_misidentified_results_are_rejected
    [{ 'model_id'=>'m2','scene_revision'=>2 },{'model_id'=>'m1','scene_revision'=>3}].each do |current|
      assert_raises(ArgumentError){Zhitan::Visualization.prepare(scene,result,current)}
    end
    bad=result;bad['samples'][0]['surface_id']='another'
    assert_raises(ArgumentError){Zhitan::Visualization.prepare(scene,bad,{'model_id'=>'m1','scene_revision'=>2})}
  end
  def test_invalid_and_wrong_units_are_rejected
    [Float::NAN,-1,'800'].each do |value|
      bad=result;bad['samples'][0]['value']=value
      assert_raises(ArgumentError){Zhitan::Visualization.prepare(scene,bad,{'model_id'=>'m1','scene_revision'=>2})}
    end
    assert_raises(ArgumentError){Zhitan::Visualization.prepare(scene,result.merge('unit'=>'lux'),{'model_id'=>'m1','scene_revision'=>2})}
  end
  def test_sample_positions_and_counts_must_match_scene
    bad=result;bad['samples'][0]['position_m']=[1,1,0]
    assert_raises(ArgumentError){Zhitan::Visualization.prepare(scene,bad,{'model_id'=>'m1','scene_revision'=>2})}
    assert_raises(ArgumentError){Zhitan::Visualization.prepare(scene,result.merge('samples'=>[]),{'model_id'=>'m1','scene_revision'=>2})}
  end
end

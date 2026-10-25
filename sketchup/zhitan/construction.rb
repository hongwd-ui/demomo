# encoding: UTF-8
module Zhitan
  module Construction
    def self.finite?(v);v.is_a?(Numeric)&&v.finite?;end
    def self.text?(v);v.is_a?(String)&&!v.strip.empty?;end
    def self.validate!(value)
      raise ArgumentError,'构造类型不支持' unless value.is_a?(Hash)&&value['kind']=='opaque_series'
      %w[id name source].each{|key|raise ArgumentError,'文本字段不能为空' unless text?(value[key])}
      %w[rsi_m2k_w rse_m2k_w].each{|key|raise ArgumentError,'表面热阻无效' unless finite?(value[key])&&value[key]>=0}
      materials=value['materials'];layers=value['layers']
      raise ArgumentError,'缺少材料或构造层' unless materials.is_a?(Array)&&!materials.empty?&&layers.is_a?(Array)&&!layers.empty?
      ids=[]
      materials.each do |material|
        raise ArgumentError,'材料标识无效' unless material.is_a?(Hash)&&text?(material['id'])&&text?(material['name'])&&!ids.include?(material['id'])
        ids<<material['id']
        %w[conductivity_w_mk density_kg_m3 specific_heat_j_kgk refractive_index].each do |key|
          next unless key=='conductivity_w_mk'||material.key?(key)
          raise ArgumentError,'材料物性无效' unless finite?(material[key])&&material[key]>0
        end
        %w[solar_absorptance solar_reflectance solar_transmittance visible_transmittance].each do |key|
          next unless material.key?(key)
          raise ArgumentError,'光学比例无效' unless finite?(material[key])&&material[key]>=0&&material[key]<=1
        end
        solar=%w[solar_absorptance solar_reflectance solar_transmittance].map{|key|material[key]}
        raise ArgumentError,'太阳光学参数不守恒' if solar.all?{|v|finite?(v)}&&(solar.inject(0.0,:+)-1).abs>0.010000001
      end
      layers.each do |layer|
        raise ArgumentError,'构造层无效' unless layer.is_a?(Hash)&&ids.include?(layer['material_id'])&&finite?(layer['thickness_m'])&&layer['thickness_m']>0
      end
      value
    end
  end
end

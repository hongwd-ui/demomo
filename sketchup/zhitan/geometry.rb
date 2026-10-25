# encoding: UTF-8
module Zhitan
  module Geometry
    IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1].freeze
    def self.multiply(a,b)
      Array.new(16){|i| row=i%4;col=i/4;(0...4).inject(0.0){|sum,k|sum+a[k*4+row]*b[col*4+k]}}
    end
    def self.determinant(m)
      m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2])
    end
    def self.point(p,m,north,origin=[0,0,0])
      x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12]-origin[0]
      y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]-origin[1]
      z=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]-origin[2]
      angle=north*Math::PI/180.0
      result=[(Math.cos(angle)*x-Math.sin(angle)*y)*0.0254,(Math.sin(angle)*x+Math.cos(angle)*y)*0.0254,z*0.0254]
      raise ArgumentError,'坐标不是有限数' unless result.all?{|v|v.finite?}
      result
    end
    def self.triangle(points,m,north,origin=[0,0,0])
      det=determinant(m);raise ArgumentError,'构件变换退化' if det.abs<1e-12
      transformed=points.map{|p|point(p,m,north,origin)}
      transformed[1],transformed[2]=transformed[2],transformed[1] if det<0
      normal(transformed)
      transformed
    end
    def self.cross(triangle)
      a,b,c=triangle
      u=b.zip(a).map{|x,y|x-y};v=c.zip(a).map{|x,y|x-y}
      [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    end
    def self.normal(triangle)
      vector=cross(triangle);length=Math.sqrt(vector.inject(0.0){|s,v|s+v*v})
      raise ArgumentError,'零面积或无效三角形' unless length.finite? && length>1e-12
      vector.map{|v|v/length}
    end
    def self.area(triangle)
      Math.sqrt(cross(triangle).inject(0.0){|sum,v|sum+v*v})/2
    end
  end
end

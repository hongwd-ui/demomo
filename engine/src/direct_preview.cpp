#include "zhitan/direct_preview.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace zhitan {
namespace {
Vec3 sub(Vec3 a,Vec3 b){return {a.x-b.x,a.y-b.y,a.z-b.z};}
Vec3 cross(Vec3 a,Vec3 b){return {a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}
double dot(Vec3 a,Vec3 b){return a.x*b.x+a.y*b.y+a.z*b.z;}
Vec3 scale(Vec3 a,double s){return {a.x*s,a.y*s,a.z*s};}
bool finite(Vec3 v){return std::isfinite(v.x)&&std::isfinite(v.y)&&std::isfinite(v.z);}
Vec3 normal(const Triangle& t){
  if(!finite(t.a)||!finite(t.b)||!finite(t.c))throw std::runtime_error("NONFINITE_GEOMETRY");
  auto n=cross(sub(t.b,t.a),sub(t.c,t.a)); auto length=std::sqrt(dot(n,n));
  if(!std::isfinite(length)||length<1e-12)throw std::runtime_error("DEGENERATE_TRIANGLE");
  return scale(n,1/length);
}
bool intersects(Vec3 origin,Vec3 direction,const Triangle& t){
  const auto e1=sub(t.b,t.a),e2=sub(t.c,t.a),p=cross(direction,e2);
  const double det=dot(e1,p); if(std::abs(det)<1e-12)return false;
  const auto offset=sub(origin,t.a); const double u=dot(offset,p)/det;
  if(u<0||u>1)return false;
  const auto q=cross(offset,e1); const double v=dot(direction,q)/det;
  if(v<0||u+v>1)return false;
  return dot(e2,q)/det>1e-7;
}
}
PreviewResult compute_direct(const Scene& scene,const SunInput& sun,const std::atomic_bool* cancelled){
  const auto length=std::sqrt(dot(sun.direction_enu,sun.direction_enu));
  if(!finite(sun.direction_enu)||!std::isfinite(length)||length<1e-12||!std::isfinite(sun.dni_w_m2)||sun.dni_w_m2<0)throw std::runtime_error("INVALID_SUN_INPUT");
  const auto direction=scale(sun.direction_enu,1/length);
  std::vector<const Triangle*> triangles; std::vector<std::string> ids; std::vector<Vec3> normals;
  for(const auto& surface:scene.surfaces)for(const auto& t:surface.triangles){triangles.push_back(&t);ids.push_back(surface.id);normals.push_back(normal(t));}
  if(triangles.empty())throw std::runtime_error("EMPTY_SCENE");
  if(triangles.size()>10000)throw std::runtime_error("PREVIEW_TRIANGLE_LIMIT_10000");
  PreviewResult result;
  for(std::size_t i=0;i<triangles.size();++i){
    if(cancelled&&cancelled->load())throw std::runtime_error("CANCELLED");
    const auto& t=*triangles[i]; const Vec3 position{(t.a.x+t.b.x+t.c.x)/3,(t.a.y+t.b.y+t.c.y)/3,(t.a.z+t.b.z+t.c.z)/3};
    double value=direction.z>0?sun.dni_w_m2*std::max(0.0,dot(normals[i],direction)):0;
    if(value>0){
      const Vec3 origin{position.x+direction.x*1e-6,position.y+direction.y*1e-6,position.z+direction.z*1e-6};
      for(std::size_t j=0;j<triangles.size();++j){
        if(cancelled&&cancelled->load())throw std::runtime_error("CANCELLED");
        if(i!=j&&intersects(origin,direction,*triangles[j])){value=0;break;}
      }
    }
    if(!finite(position)||!std::isfinite(value))throw std::runtime_error("NUMERIC_RANGE");
    result.samples.push_back({ids[i],position,value});
  }
  return result;
}
}

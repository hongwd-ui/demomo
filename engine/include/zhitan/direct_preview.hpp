#pragma once
#include <atomic>
#include <string>
#include <vector>
namespace zhitan {
struct Vec3 { double x,y,z; };
struct Triangle { Vec3 a,b,c; };
struct Surface { std::string id; std::vector<Triangle> triangles; };
struct Scene { std::string model_id; long long scene_revision; std::vector<Surface> surfaces; };
struct SunInput { Vec3 direction_enu; double dni_w_m2; };
struct Sample { std::string surface_id; Vec3 position; double value; };
struct PreviewResult { std::vector<Sample> samples; };
PreviewResult compute_direct(const Scene&,const SunInput&,const std::atomic_bool* cancelled=nullptr);
}

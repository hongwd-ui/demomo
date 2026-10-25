#include "zhitan/direct_preview.hpp"
#include <cmath>
#include <iostream>
#include <stdexcept>
using namespace zhitan;
void check(bool condition, const char* message) { if (!condition) throw std::runtime_error(message); }
int main() {
  Scene scene{"model-1", 2, {{"floor", {{{0,0,0},{2,0,0},{0,2,0}}}}}};
  auto result = compute_direct(scene, {{0,0,1},800});
  check(result.samples.size()==1, "one centroid per triangle");
  check(std::abs(result.samples[0].value-800)<1e-8, "face normal to sun receives DNI");
  check(std::abs(result.samples[0].position.x-2.0/3)<1e-8, "centroid position");
  check(compute_direct(scene, {{0,0,-1},800}).samples[0].value==0, "sun below horizon gives zero");
  check(compute_direct(scene, {{0,0,1},0}).samples[0].value==0, "zero DNI gives zero");
  check(std::abs(compute_direct(scene, {{0,1,1},800}).samples[0].value-565.685424949)<1e-6, "cosine projection");
  scene.surfaces.push_back({"shade", {{{-5,-5,1},{10,-5,1},{-5,10,1}}}});
  check(compute_direct(scene, {{0,0,1},800}).samples[0].value==0, "opaque shade blocks sun");
  Scene reversed{"model-1",2,{{"back",{{{0,0,0},{0,2,0},{2,0,0}}}}}};
  check(compute_direct(reversed, {{0,0,1},800}).samples[0].value==0, "back face not irradiated");
  Scene degenerate{"model-1",2,{{"bad",{{{0,0,0},{0,0,0},{2,0,0}}}}}};
  bool rejected=false;try { compute_direct(degenerate, {{0,0,1},800}); }catch(const std::exception&){rejected=true;}
  check(rejected,"zero-area geometry rejected");
  rejected=false;try { compute_direct(scene, {{0,0,0},800}); }catch(const std::exception&){rejected=true;}
  check(rejected,"zero direction rejected");
  rejected=false;try { compute_direct(scene, {{0,0,1},-1}); }catch(const std::exception&){rejected=true;}
  check(rejected,"negative DNI rejected");
  std::atomic_bool cancel{true}; rejected=false;
  try { compute_direct(scene, {{0,0,1},800}, &cancel); }catch(const std::exception&){rejected=true;}
  check(rejected,"cancelled calculation has no valid result");
  std::cout << "12 direct-preview checks passed\n";
}

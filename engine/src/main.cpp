#include "zhitan/direct_preview.hpp"
#include "zhitan/job_state.hpp"
#include <cmath>
#include <nlohmann/json.hpp>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <set>
#include <sstream>
#include <thread>
using json=nlohmann::json;
namespace fs=std::filesystem;
using namespace zhitan;
namespace {
std::mutex output_mutex;
void emit(const json& message){std::lock_guard<std::mutex> lock(output_mutex);std::cout<<message.dump()<<'\n'<<std::flush;}
json reply(const json& request,const std::string& type,json payload){
  return {{"protocol_version",1},{"request_id",request.value("request_id",std::string("invalid"))},
    {"type",type},{"model_id",request.value("model_id",std::string("unbound"))},
    {"scene_revision",request.value("scene_revision",0LL)},{"payload",std::move(payload)}};
}
void error(const json& request,const std::string& code){emit(reply(request,"request.error",{{"code",code},{"message",code},{"retryable",false}}));}
bool line(std::string& value,bool& oversized){
  value.clear();oversized=false;char c;
  while(std::cin.get(c)){if(c=='\n')return true;if(value.size()<1048576)value+=c;else oversized=true;}
  return !value.empty()||oversized;
}
Vec3 vector3(const json& data){
  if(!data.is_array()||data.size()!=3)throw std::runtime_error("INVALID_VECTOR");
  Vec3 v{data.at(0).get<double>(),data.at(1).get<double>(),data.at(2).get<double>()};
  if(!std::isfinite(v.x)||!std::isfinite(v.y)||!std::isfinite(v.z))throw std::runtime_error("NONFINITE_VECTOR");return v;
}
fs::path safe_read_path(const fs::path& root,const std::string& relative){
  fs::path p(relative);
  if(relative.empty()||relative.find('\\')!=std::string::npos||relative.find(':')!=std::string::npos||p.is_absolute())throw std::runtime_error("INVALID_PATH");
  for(const auto& part:p)if(part=="..")throw std::runtime_error("INVALID_PATH");
  auto resolved=fs::canonical(root/p);auto mismatch=std::mismatch(root.begin(),root.end(),resolved.begin(),resolved.end());
  if(mismatch.first!=root.end()||!fs::is_regular_file(resolved)||fs::file_size(resolved)>67108864)throw std::runtime_error("INVALID_SCENE_FILE");
  return resolved;
}
Scene read_scene(const fs::path& path,const json& request){
  std::ifstream input(path);json data=json::parse(input);
  if(data.at("schema_version")!=1||data.at("coordinate_system")!="local_enu_m"||data.at("model_id")!=request.at("model_id")||data.at("scene_revision")!=request.at("scene_revision"))throw std::runtime_error("SCENE_IDENTITY_MISMATCH");
  Scene scene{data.at("model_id").get<std::string>(),data.at("scene_revision").get<long long>(),{}};
  std::set<std::string> ids;std::size_t total=0;
  for(const auto& item:data.at("surfaces")){
    Surface surface{item.at("id").get<std::string>(),{}};
    if(surface.id.empty()||!ids.insert(surface.id).second)throw std::runtime_error("INVALID_SURFACE_ID");
    for(const auto& triangle:item.at("triangles")){
      if(!triangle.is_array()||triangle.size()!=3)throw std::runtime_error("INVALID_TRIANGLE");
      surface.triangles.push_back({vector3(triangle.at(0)),vector3(triangle.at(1)),vector3(triangle.at(2))});
      if(++total>10000)throw std::runtime_error("PREVIEW_TRIANGLE_LIMIT_10000");
    }
    scene.surfaces.push_back(std::move(surface));
  }
  if(total==0)throw std::runtime_error("EMPTY_SCENE");return scene;
}
std::string fingerprint(const std::string& data){
  // Non-cryptographic reproducibility fingerprint; not an integrity or security check.
  std::uint64_t hash=14695981039346656037ULL;for(unsigned char c:data){hash^=c;hash*=1099511628211ULL;}
  std::ostringstream out;out<<"fnv1a64:"<<std::hex<<hash;return out.str();
}
}
int main(int argc,char** argv){
  if(argc!=2){std::cerr<<"Usage: zhitan_worker TASK_ROOT\n";return 2;}
  fs::path root;try{root=fs::canonical(argv[1]);if(!fs::is_directory(root))return 2;}catch(...){return 2;}
  JobState task;std::thread worker;std::string active_job;
  std::string raw;bool oversized;
  while(line(raw,oversized)){
    json request={{"request_id","invalid"},{"model_id","unbound"},{"scene_revision",0}};
    try{
      if(oversized)throw std::runtime_error("MESSAGE_TOO_LARGE");
      auto parsed=json::parse(raw);
      if(!parsed.is_object()||parsed.value("protocol_version",0)!=1||!parsed.contains("request_id")||!parsed.at("request_id").is_string()||parsed.at("request_id").get<std::string>().empty()
        ||!parsed.contains("model_id")||!parsed.at("model_id").is_string()||parsed.at("model_id").get<std::string>().empty()
        ||!parsed.contains("scene_revision")||!parsed.at("scene_revision").is_number_integer()||parsed.at("scene_revision").get<long long>()<0
        ||!parsed.contains("payload")||!parsed.at("payload").is_object())throw std::runtime_error("INVALID_ENVELOPE");
      request=parsed;
      const auto type=request.at("type").get<std::string>();const auto payload=request.at("payload");
      if(type=="analysis.cancel"){
        if(payload.value("job_id",std::string())!=active_job||!task.request_cancel())throw std::runtime_error("JOB_NOT_RUNNING");
        emit(reply(request,type,{{"job_id",active_job},{"cancel_requested",true}}));continue;
      }
      if(type!="analysis.start")throw std::runtime_error("UNKNOWN_MESSAGE");
      if(task.active())throw std::runtime_error("WORKER_BUSY");
      if(worker.joinable())worker.join();
      if(payload.at("mode")!="direct_preview")throw std::runtime_error("UNSUPPORTED_MODE");
      auto scene=read_scene(safe_read_path(root,payload.at("scene_path").get<std::string>()),request);
      const auto settings=payload.at("settings");SunInput sun{vector3(settings.at("sun_direction_enu")),settings.at("dni_w_m2").get<double>()};
      const double length=std::hypot(sun.direction_enu.x,sun.direction_enu.y,sun.direction_enu.z);
      if(!std::isfinite(length)||length<1e-12||!std::isfinite(sun.dni_w_m2)||sun.dni_w_m2<0)throw std::runtime_error("INVALID_SUN_INPUT");
      active_job="job-"+std::to_string(std::chrono::steady_clock::now().time_since_epoch().count());
      const auto job=active_job;const auto job_dir=root/job;
      if(!fs::create_directory(job_dir))throw std::runtime_error("JOB_DIRECTORY_FAILED");
      task.begin();
      emit(reply(request,type,{{"job_id",job}}));
      worker=std::thread([&,scene=std::move(scene),sun,request,settings,job,job_dir](){
        try{
          const auto result=compute_direct(scene,sun,task.cancellation_flag());json samples=json::array();
          for(const auto& sample:result.samples)samples.push_back({{"surface_id",sample.surface_id},{"position_m",{sample.position.x,sample.position.y,sample.position.z}},{"value",sample.value}});
          const auto relative=job+"/result.json";
          json output={{"schema_version",1},{"model_id",scene.model_id},{"scene_revision",scene.scene_revision},{"job_id",job},
            {"engine_version","zhitan-direct-0.1.0"},{"quality","direct_preview"},{"metric","incident_irradiance"},{"unit","W_m2"},
            {"settings_hash",fingerprint(settings.dump())},{"material_hash","not_used_opaque_direct_only"},
            {"created_at_unix_ms",std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count()},
            {"samples",samples},{"diagnostics",{"DIRECT_ONLY_NO_SKY_OR_REFLECTIONS","ONE_SAMPLE_PER_TRIANGLE","ALL_OCCLUDERS_OPAQUE"}}};
          {std::ofstream file(job_dir/"result.tmp");file<<output.dump();if(!file)throw std::runtime_error("RESULT_WRITE_FAILED");}
          const bool completed=task.complete([&](){
            fs::rename(job_dir/"result.tmp",root/relative);
            emit(reply(request,"job.result",{{"job_id",job},{"status","completed"},{"result_path",relative},{"quality","direct_preview"}}));
          });
          if(!completed)throw std::runtime_error("CANCELLED");
        }catch(const std::exception& e){
          std::error_code ignored;fs::remove(job_dir/"result.tmp",ignored);
          task.fail([&](){
            const std::string code=task.cancelled()?"CANCELLED":"COMPUTE_FAILED";
            emit(reply(request,"job.error",{{"job_id",job},{"code",code},{"message",code},{"retryable",false}}));
            std::cerr<<"Worker task failed: "<<code<<'\n';
          });
          (void)e;
        }
      });
    }catch(const json::exception&){error(request,"INVALID_JSON_OR_FIELDS");}
    catch(const fs::filesystem_error&){error(request,"INVALID_SCENE_FILE");}
    catch(const std::exception& e){error(request,e.what());}
  }
  task.request_cancel();if(worker.joinable())worker.join();return 0;
}

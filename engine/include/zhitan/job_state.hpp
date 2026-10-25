#pragma once
#include <atomic>
#include <mutex>
namespace zhitan {
class JobState {
  std::mutex mutex_;
  std::atomic_bool active_{false},cancelled_{false};
public:
  void begin(){std::lock_guard<std::mutex> lock(mutex_);cancelled_=false;active_=true;}
  bool active()const{return active_.load();}
  bool cancelled()const{return cancelled_.load();}
  const std::atomic_bool* cancellation_flag()const{return &cancelled_;}
  bool request_cancel(){std::lock_guard<std::mutex> lock(mutex_);if(!active_)return false;cancelled_=true;return true;}
  template<class Commit>bool complete(Commit commit){
    std::lock_guard<std::mutex> lock(mutex_);
    if(cancelled_){active_=false;return false;}
    commit();active_=false;return true;
  }
  template<class Commit>void fail(Commit commit){std::lock_guard<std::mutex> lock(mutex_);commit();active_=false;}
};
}

#include "zhitan/job_state.hpp"
#include <future>
#include <iostream>
#include <stdexcept>
using namespace zhitan;
void check(bool v){if(!v)throw std::runtime_error("invalid terminal transition");}
int main(){
  JobState state;
  state.begin();check(state.request_cancel());bool published=false;
  check(!state.complete([&](){published=true;}));check(!published);check(!state.request_cancel());
  state.begin();std::promise<void> entered,release;auto proceed=release.get_future();
  auto completion=std::async(std::launch::async,[&](){return state.complete([&](){entered.set_value();proceed.wait();published=true;});});
  entered.get_future().wait();
  auto cancellation=std::async(std::launch::async,[&](){return state.request_cancel();});
  release.set_value();check(completion.get());check(!cancellation.get());check(published);
  std::cout<<"cancel and completion are mutually exclusive\n";
}

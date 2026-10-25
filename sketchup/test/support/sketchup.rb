# Minimal host-shaped doubles; no geometry or rendering API is emulated.
module Sketchup
  class ModelObserver;end
  class MaterialsObserver;end
  class AppObserver;end
  def self.active_model;@active_model;end
  def self.active_model=(model);@active_model=model;end
  def self.version;'test-double';end
  def self.add_observer(_observer);end
end
module UI
  class << self;attr_accessor :messages,:save_path,:open_count,:last_dialog;end
  class Menu
    def add_submenu(_name);self;end
    def add_item(_name);end
  end
  def self.menu(_name);Menu.new;end
  def self.messagebox(message);self.messages<<message;end
  def self.openpanel(*_args);self.open_count+=1;nil;end
  def self.savepanel(*_args);save_path;end
  def self.start_timer(*_args);1;end
  def self.stop_timer(_timer);end
  class HtmlDialog
    attr_reader :scripts
    def initialize(*_args);@scripts=[];@visible=false;UI.last_dialog=self;end
    def execute_script(script);@scripts<<script;end
    def add_action_callback(_name);end
    def set_on_closed(&block);@on_closed=block;end
    def set_file(_path);end
    def visible?;@visible;end
    def show;@visible=true;end
    def bring_to_front;end
    def close;@visible=false;@on_closed.call;end
  end
end
def file_loaded?(_file);false;end
def file_loaded(_file);end

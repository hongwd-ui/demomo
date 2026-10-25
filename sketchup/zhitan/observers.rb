# encoding: UTF-8
module Zhitan
  module Observers
    class Transactions < Sketchup::ModelObserver
      def onTransactionCommit(model);Zhitan.changed(model);end
      def onTransactionUndo(model);Zhitan.changed(model);end
      def onTransactionRedo(model);Zhitan.changed(model);end
      def onActivePathChanged(model);Zhitan.changed(model);end
    end
    class Materials < Sketchup::MaterialsObserver
      def onMaterialChange(materials,_material);Zhitan.changed(Sketchup.active_model) if materials==Sketchup.active_model.materials;end
      def onMaterialRemove(materials,_material);Zhitan.changed(Sketchup.active_model) if materials==Sketchup.active_model.materials;end
    end
    class Application < Sketchup::AppObserver
      def onNewModel(model);Zhitan.bind_model(model);end
      def onOpenModel(model);Zhitan.bind_model(model);end
      def onActivateModel(model);Zhitan.bind_model(model);end
    end
    def self.attach(model)
      detach
      @model=model;@transactions=Transactions.new;@materials=Materials.new
      model.add_observer(@transactions);model.materials.add_observer(@materials)
    end
    def self.detach
      if @model&&@model.valid?
        @model.remove_observer(@transactions);@model.materials.remove_observer(@materials)
      end
      @model=nil
    end
  end
end

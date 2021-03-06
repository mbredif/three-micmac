export default {

    addWireFrameCheckbox(gui, view, layer) {
        gui.add(layer, 'wireframe').name('Wireframe').onChange(() => view.notifyChange(layer));
    },

    addMaterialSize(gui, view, layer, begin, end) {
        layer.size = layer.size || 1;
        gui.add(layer, 'size', begin, end).name('Size').onChange(() => view.notifyChange(layer));
    },

    addMaterialLineWidth(gui, view, layer, begin, end) {
        layer.linewidth = layer.linewidth || 1;
        gui.add(layer, 'linewidth', begin, end).name('Line Width').onChange(() => view.notifyChange(layer));
    },

    createGeometryDebugUI(datDebugTool, view, layer) {
        const gui = datDebugTool.addFolder(`Layer ${layer.id}`);
        gui.add(layer, 'visible').name('Visible').onChange(() => view.notifyChange(layer));
        gui.add(layer, 'opacity', 0, 1).name('Opacity').onChange(() => view.notifyChange(layer));
        return gui;
    },
};

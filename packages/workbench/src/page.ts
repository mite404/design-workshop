// The Workbench page: the running app in a frame.
const frame = document.createElement("iframe");
frame.src = "/";
frame.title = "Canvas";
frame.style.cssText = "position: fixed; inset: 0; width: 100%; height: 100%; border: 0";
document.body.append(frame);

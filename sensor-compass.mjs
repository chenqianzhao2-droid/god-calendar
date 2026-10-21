// Trial, portrait/face-up only. Does not request location or persist sensor data.
export const normalize = angle => ((angle % 360) + 360) % 360;
export const shortestDelta = (from, to) => ((to - from + 540) % 360) - 180;
export function smoothHeading(previous, next, weight = .22) {
  return previous === null ? normalize(next) : previous + shortestDelta(normalize(previous), normalize(next)) * weight;
}
export function directionName(angle) {
  return ['北','东北','东','东南','南','西南','西','西北'][Math.floor((normalize(angle) + 22.5) / 45) % 8];
}
export function readHeading(event, screenAngle = 0) {
  const ios = Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0 && event.webkitCompassHeading <= 360;
  const absolute = (event.absolute === true || event.type === 'deviceorientationabsolute') && Number.isFinite(event.alpha);
  if (!ios && !absolute) return {reason:'relative'};
  // Initial trial deliberately avoids claiming accurate tilt/landscape compensation.
  if (normalize(screenAngle) !== 0) return {reason:'landscape'};
  if ((Number.isFinite(event.beta) && Math.abs(event.beta) > 30) || (Number.isFinite(event.gamma) && Math.abs(event.gamma) > 30)) return {reason:'tilt'};
  const accuracy = ios && Number.isFinite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : null;
  if (accuracy !== null && accuracy < 0) return {reason:'calibration'};
  return {heading:normalize(ios ? event.webkitCompassHeading : 360-event.alpha), source:ios?'iOS方向传感器':'浏览器绝对方向', accuracy};
}

export function createCompassController(host, changed = () => {}) {
  let state = {active:false,status:'idle',heading:null,angle:0,source:'',accuracy:null,message:'固定方位图 · 点击启用后读取手机方向'};
  let sequence = 0, initialTimer = null, staleTimer = null, angle = null, relativeSeen = false;
  const emit = patch => { state = {...state,...patch}; changed({...state}); };
  const clearTimers = () => {
    if (initialTimer !== null) host.clearTimeout(initialTimer);
    if (staleTimer !== null) host.clearTimeout(staleTimer);
    initialTimer = staleTimer = null;
  };
  const detach = () => {
    host.removeEventListener('deviceorientation', sample);
    host.removeEventListener('deviceorientationabsolute', sample);
    host.removeEventListener('almanaccompass', nativeSample);
    if(host.AlmanacNative?.stopCompass)host.AlmanacNative.stopCompass();
    clearTimers();
  };
  function stop(message='已停用实时罗盘 · 恢复固定方位图', status='idle') {
    sequence++; detach(); angle = null;
    emit({active:false,status,heading:null,angle:0,source:'',accuracy:null,message});
  }
  function staleWatch() {
    if (staleTimer !== null) host.clearTimeout(staleTimer);
    staleTimer = host.setTimeout(() => stop('方向数据已中断 · 当前为固定图，请重新启用','stale'),4000);
  }
  function nativeSample(event){if(event.detail?.unreliable){if(!state.active)return;if(initialTimer!==null)host.clearTimeout(initialTimer);initialTimer=null;staleWatch();angle=null;emit({status:'calibration',heading:null,angle:0,message:'设备方向精度不足 · 请远离磁性物体并校准'});return;}sample({...event.detail,type:'deviceorientationabsolute',absolute:true});}
  function sample(event) {
    if (!state.active) return;
    const screenAngle = host.screen?.orientation?.angle ?? (Number.isFinite(host.orientation)?host.orientation:0);
    const result = readHeading(event,screenAngle);
    if (result.reason === 'relative') { relativeSeen = true; return; }
    if (initialTimer !== null) host.clearTimeout(initialTimer);
    initialTimer = null;
    staleWatch();
    if (result.reason) {
      angle = null;
      const messages = {
        landscape:'请回到竖屏正向 · 试行版暂不支持横屏实时罗盘',
        tilt:'请将手机屏幕朝上平放 · 倾斜过大时盘面暂固定',
        calibration:'设备提示需要校准 · 远离磁吸配件与金属后重试'
      };
      emit({status:result.reason,heading:null,angle:0,source:'',accuracy:null,message:messages[result.reason]});
      return;
    }
    angle = smoothHeading(angle,result.heading);
    emit({status:'live',heading:normalize(angle),angle,source:event.nativeSensor?'安卓系统方向传感器':result.source,accuracy:result.accuracy,
      message:result.accuracy !== null && result.accuracy > 30 ? '正在读取 · 设备报告精度较低，请远离磁性物体' : '实时方向试用中 · 固定指针指向手机顶部'});
  }
  async function start() {
    stop();
    const token = sequence;
    if (!host.isSecureContext) { stop('实时方向需要HTTPS · 当前仍是固定方位图','unavailable'); return; }
    if(host.AlmanacNative?.startCompass){
      relativeSeen=false;
      host.addEventListener('almanaccompass',nativeSample);
      emit({active:true,status:'waiting',message:'等待安卓系统方向数据 · 请竖屏平放'});
      initialTimer=host.setTimeout(()=>stop('未收到系统方向数据 · 请检查传感器并重试','unavailable'),7000);
      try{if(!host.AlmanacNative.startCompass())stop('设备未提供可用方向传感器 · 当前为固定图','unavailable');}catch{stop('系统方向传感器启动失败 · 当前为固定图','unavailable');}
      return;
    }
    const Orientation = host.DeviceOrientationEvent;
    if (!Orientation) { stop('当前浏览器未提供方向接口 · 请在手机Safari或Chrome中打开','unavailable'); return; }
    emit({status:'requesting',message:'正在请求方向权限 · 不需要定位权限'});
    try {
      // Called directly from a user click, before any other awaited work.
      const result = typeof Orientation.requestPermission === 'function' ? await Orientation.requestPermission(true) : 'granted';
      if (token !== sequence) return;
      if (result !== 'granted') { stop('未获得方向权限 · 允许后可重试，当前为固定图','denied'); return; }
      relativeSeen = false;
      host.addEventListener('deviceorientation',sample);
      host.addEventListener('deviceorientationabsolute',sample);
      emit({active:true,status:'waiting',message:'等待真实北向数据 · 请竖屏、屏幕朝上平放'});
      initialTimer = host.setTimeout(() => stop(relativeSeen?'仅收到相对转动，无法确定北向 · 已恢复固定图':'未收到方向数据 · 设备可能不支持，或权限未开启','unavailable'),7000);
    } catch {
      if (token === sequence) stop('方向授权失败 · 请在手机浏览器直接打开后重试','denied');
    }
  }
  return {start,stop,snapshot:()=>({...state})};
}

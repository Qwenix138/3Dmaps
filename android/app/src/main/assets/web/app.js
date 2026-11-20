(function () {
  'use strict';

  const D = window.D3M;
  const $ = (id) => document.getElementById(id);
  const RAD = Math.PI / 180;
  const TILE = 256;
  const MAX_AREA_KM2 = 225;
  const AREA_TOLERANCE_KM2 = 0.005;
  const MAX_DEM_TILES = 36;
  const MAX_TERRAIN_CELLS = 160000;
  const DEFAULT_ZONE_KM = 1;
  const MIN_ZONE_KM = 0.1;
  const MAX_ZONE_KM = 15;
  const MIN_ZONE_PX = 22;

  const LANG_KEY = 'd3maps.lang';
  const STRINGS = {
    ru: {
      'app.title': '3Dmaps — офлайн-генератор',
      'brand.title': '3Dmaps',
      'brand.badge': 'offline',
      'brand.sub': 'Установил — и пользуешься. Выдели участок, получи OBJ/GLB.',
      'help.button': 'Справка',
      'search.label': 'Найти место',
      'search.placeholder': 'Город, адрес или координаты',
      'search.find': 'Найти',
      'search.locate': 'Моё место',
      'search.clear': 'Очистить',
      'zone.label': 'Зона',
      'zone.none': 'Рамка не выбрана',
      'zone.hint': 'Тяни углы и стороны. Центр или любое место внутри рамки — перемещение.',
      'zone.advanced': 'Точные размеры',
      'zone.width': 'Ширина, км',
      'zone.height': 'Высота, км',
      'zone.lat': 'Широта центра',
      'zone.lon': 'Долгота центра',
      'zone.apply': 'Применить зону',
      'zone.center': 'В центр карты',
      'zone.sizeRange': 'Ширина и высота — от 0.1 до {max} км.',
      'zone.badCoords': 'Проверь широту и долготу центра.',
      'zone.dateline': 'Зона пересекает границу долгот — сдвинь центр.',
      'zone.updated': 'Зона обновлена',
      'zone.centered': 'Зона в центре карты',
      'name.label': 'Название',
      'spacing.label': 'Шаг рельефа, м',
      'texture.label': 'Текстура',
      'terrain.heading': 'Настройки рельефа',
      'height.label': 'Высота рельефа',
      'smoothing.label': 'Сглаживание',
      'smoothing.none': 'Нет',
      'smoothing.light': 'Лёгкое',
      'smoothing.strong': 'Сильное',
      'terrain.hint': 'Высота усиливает или ослабляет рельеф относительно средней точки; сглаживание убирает шум DEM.',
      'quality.fast': 'Быстро',
      'quality.balanced': 'Баланс',
      'quality.detail': 'Детально',
      'layer.satellite': 'Спутник',
      'layer.labels': 'Подписи',
      'layer.buildings': 'Здания',
      'layer.roads': 'Дороги',
      'layer.railways': 'Ж/д',
      'layer.water': 'Вода',
      'notice.local': 'Всё считается на телефоне. Нужен только интернет для OSM, высот и спутника. Google-данные не используются.',
      'generate.button': 'Сгенерировать 3D-участок',
      'status.generating': 'Генерация',
      'status.preparing': 'Подготовка',
      'status.done': 'Готово',
      'status.stopped': 'Остановлено',
      'result.done': 'Готово',
      'result.saveAll': 'Сохранить всё',
      'result.preview': '3D-просмотр',
      'result.glb': 'Только GLB',
      'result.obj': 'OBJ + MTL',
      'result.previewHint': 'Крути пальцем, масштаб — двумя пальцами.',
      'result.save': 'Сохранить',
      'result.files': 'Файлы',
      'result.area': 'Площадь',
      'result.triangles': 'Треугольники',
      'result.buildings': 'Здания',
      'result.roads': 'Дороги',
      'result.water': 'Вода',
      'result.count': '{buildings} зд. · {roads} дорог',
      'result.trianglesLabel': '3Dmaps · {count} треугольников',
      'footer.licenses': 'OSM © contributors, ODbL. Спутник Sentinel-2 cloudless, EOX, CC BY-NC-SA.',
      'help.title': 'Как это работает',
      'help.close': 'Закрыть',
      'quality.label': 'Качество рельефа',
      'help.intro': '3Dmaps работает прямо в приложении, без сервера и настройки.',
      'help.step1': 'Найди место или подвинь карту.',
      'help.step2': 'Нажми «Рамка» и проведи прямоугольник. Потом тяни его за углы или стороны, а за центральную точку или изнутри — перемещай. Пресеты 0.5–3 км задают квадрат.',
      'help.step3': 'На карте видны размеры зоны, масштаб и координаты центра.',
      'help.step4': 'Выбери шаг и настройки рельефа, текстуру и слои, нажми «Сгенерировать».',
      'help.step5': 'Сохрани всё или только GLB / OBJ+MTL в <b>Download/3Dmaps/название</b>. OBJ сохраняется с расширением <b>.obj</b>, MTL — <b>.mtl</b>.',
      'help.limit': 'Нужен интернет: карта, OSM, DEM Terrarium и спутник EOX загружаются из сети. Генерация и файлы — локально. Максимальная зона — 15 × 15 км (225 км²). Большие зоны считать дольше; в плотной застройке лучше 2–4 км².',
      'help.data': 'Данные: OpenStreetMap ODbL; Terrarium DEM; Sentinel-2 cloudless EOX CC BY-NC-SA 4.0 (некоммерческое использование).',
      'map.loading': 'Карта загружается…',
      'map.hint.pan': 'Тяни карту · «Рамка» — выделить зону',
      'map.hint.select': 'Проведи пальцем рамку на карте',
      'map.hint.zoom': 'Увеличь масштаб, чтобы загрузить карту',
      'map.hint.changed': 'Зона изменена — тяни края или углы',
      'map.hint.searching': 'Ищу…',
      'map.hint.notFound': 'Место не найдено',
      'map.hint.outside': 'Место вне поддерживаемой зоны',
      'map.hint.dateline': 'Зона пересекает границу долгот',
      'map.hint.boxSet': 'Рамка установлена',
      'map.hint.searchUnavailable': 'Поиск недоступен',
      'map.hint.geoUnavailable': 'Геолокация недоступна',
      'map.hint.locating': 'Определяю место…',
      'map.hint.aroundYou': 'Рамка вокруг тебя',
      'map.hint.locateFailed': 'Не удалось определить место',
      'map.hint.tileError': 'Карта не загрузилась — проверь интернет',
      'map.select': 'Выделить рамку',
      'area.pill': '{area} км²',
      'area.summary': '{width} × {height} км · {status}',
      'area.ready': 'можно генерировать',
      'area.tooSmall': 'слишком маленькая зона',
      'area.tooLarge': 'макс. {max} × {max} км',
      'area.reduce': 'уменьши зону до {area} км²',
      'area.zero': '0 км²',
      'progress.checkZone': 'Проверка зоны',
      'progress.dem': 'Загрузка высот DEM',
      'progress.demDone': 'Высоты готовы',
      'progress.osm': 'Загрузка OpenStreetMap',
      'progress.osmOverpass': 'Загрузка OSM через Overpass ({current}/{total})',
      'progress.osmParse': 'Разбор зданий и дорог',
      'progress.osmTiles': 'OSM API: участок {done}',
      'progress.geometry': 'Геометрия',
      'progress.textures': 'Подписи и схема',
      'progress.satellite': 'Загрузка спутника EOX',
      'progress.satelliteFailed': 'Спутник недоступен, строю рельеф',
      'progress.relief': 'Рельефная текстура',
      'progress.texturesDone': 'Текстуры готовы',
      'progress.pack': 'Упаковка файлов',
      'progress.done': 'Готово',
      'progress.areaTooLarge': 'Зона больше лимита {max} × {max} км ({area} км²). Уменьши рамку.',
      'warnings.demTile': 'DEM тайл {x}/{y} недоступен',
      'warnings.spacing': 'Шаг рельефа увеличен до {step} м из-за размера зоны',
      'warnings.osmTiles': 'Часть OSM не загрузилась: участков — {count}',
      'warnings.satellite': 'Спутник недоступен: {error}',
      'warning.title': 'Предупреждения',
      'bytes.b': 'Б',
      'bytes.kb': 'КБ',
      'bytes.mb': 'МБ',
      'bytes.gb': 'ГБ',
      'km': 'км',
      'm': 'м',
      'error.decode': 'Не удалось декодировать изображение',
      'error.timeout': 'Таймаут запроса',
      'error.osmXml': 'OSM вернул некорректный XML',
      'error.osmFailed': 'Не удалось загрузить OSM: {error}'
    },
    en: {
      'app.title': '3Dmaps — offline generator',
      'brand.title': '3Dmaps',
      'brand.badge': 'offline',
      'brand.sub': 'Install and go. Select an area, get OBJ/GLB.',
      'help.button': 'Help',
      'search.label': 'Find a place',
      'search.placeholder': 'City, address or coordinates',
      'search.find': 'Search',
      'search.locate': 'My location',
      'search.clear': 'Clear',
      'zone.label': 'Area',
      'zone.none': 'No area selected',
      'zone.hint': 'Drag corners and edges. Drag the center or anywhere inside to move the area.',
      'zone.advanced': 'Exact size',
      'zone.width': 'Width, km',
      'zone.height': 'Height, km',
      'zone.lat': 'Center latitude',
      'zone.lon': 'Center longitude',
      'zone.apply': 'Apply area',
      'zone.center': 'Center on map',
      'zone.sizeRange': 'Width and height must be from 0.1 to {max} km.',
      'zone.badCoords': 'Check the center latitude and longitude.',
      'zone.dateline': 'The area crosses the date line — move the center.',
      'zone.updated': 'Area updated',
      'zone.centered': 'Area centered on map',
      'name.label': 'Name',
      'spacing.label': 'Terrain step, m',
      'texture.label': 'Texture',
      'terrain.heading': 'Terrain settings',
      'height.label': 'Terrain height',
      'smoothing.label': 'Smoothing',
      'smoothing.none': 'None',
      'smoothing.light': 'Light',
      'smoothing.strong': 'Strong',
      'terrain.hint': 'Height scales the terrain around the mean elevation; smoothing removes DEM noise.',
      'quality.fast': 'Fast',
      'quality.balanced': 'Balanced',
      'quality.detail': 'Detailed',
      'layer.satellite': 'Satellite',
      'layer.labels': 'Labels',
      'layer.buildings': 'Buildings',
      'layer.roads': 'Roads',
      'layer.railways': 'Railways',
      'layer.water': 'Water',
      'notice.local': 'Everything runs on the phone. Internet is only needed for OSM, elevation and satellite data. No Google data is used.',
      'generate.button': 'Generate 3D area',
      'status.generating': 'Generating',
      'status.preparing': 'Preparing',
      'status.done': 'Done',
      'status.stopped': 'Stopped',
      'result.done': 'Done',
      'result.saveAll': 'Save all',
      'result.preview': '3D preview',
      'result.glb': 'GLB only',
      'result.obj': 'OBJ + MTL',
      'result.previewHint': 'Drag to rotate, pinch to zoom.',
      'result.save': 'Save',
      'result.files': 'Files',
      'result.area': 'Area',
      'result.triangles': 'Triangles',
      'result.buildings': 'Buildings',
      'result.roads': 'Roads',
      'result.water': 'Water',
      'result.count': '{buildings} bldg · {roads} roads',
      'result.trianglesLabel': '3Dmaps · {count} triangles',
      'footer.licenses': 'OSM © contributors, ODbL. Sentinel-2 cloudless by EOX, CC BY-NC-SA.',
      'help.title': 'How it works',
      'help.close': 'Close',
      'quality.label': 'Terrain quality',
      'help.intro': '3Dmaps runs entirely in the app, with no server or setup.',
      'help.step1': 'Find a place or move the map.',
      'help.step2': 'Tap “Box” and draw a rectangle. Drag its corners or edges, the center point, or anywhere inside to move it. Presets set a 0.5–3 km square.',
      'help.step3': 'The map shows the area size, scale and center coordinates.',
      'help.step4': 'Choose the terrain step and settings, texture and layers, then tap “Generate”.',
      'help.step5': 'Save everything, or only GLB / OBJ+MTL to <b>Download/3Dmaps/name</b>. OBJ is saved as <b>.obj</b>, MTL as <b>.mtl</b>.',
      'help.limit': 'Internet is required for the map, OSM, Terrarium DEM and EOX satellite. Generation and files are local. Maximum area is 15 × 15 km (225 km²); large areas take longer, and 2–4 km² is best in dense cities.',
      'help.data': 'Data: OpenStreetMap ODbL; Terrarium DEM; Sentinel-2 cloudless EOX CC BY-NC-SA 4.0 (non-commercial use).',
      'map.loading': 'Loading map…',
      'map.hint.pan': 'Drag the map · “Box” to select an area',
      'map.hint.select': 'Draw a rectangle on the map',
      'map.hint.zoom': 'Zoom in to load the map',
      'map.hint.changed': 'Area changed — drag edges or corners',
      'map.hint.searching': 'Searching…',
      'map.hint.notFound': 'Place not found',
      'map.hint.outside': 'Place is outside the supported area',
      'map.hint.dateline': 'The area crosses the date line',
      'map.hint.boxSet': 'Area set',
      'map.hint.searchUnavailable': 'Search unavailable',
      'map.hint.geoUnavailable': 'Geolocation unavailable',
      'map.hint.locating': 'Locating…',
      'map.hint.aroundYou': 'Area around you',
      'map.hint.locateFailed': 'Could not determine your location',
      'map.hint.tileError': 'Map failed to load — check your connection',
      'map.select': 'Select area',
      'area.pill': '{area} km²',
      'area.summary': '{width} × {height} km · {status}',
      'area.ready': 'ready to generate',
      'area.tooSmall': 'area is too small',
      'area.tooLarge': 'max {max} × {max} km',
      'area.reduce': 'reduce the area to {area} km²',
      'area.zero': '0 km²',
      'progress.checkZone': 'Checking area',
      'progress.dem': 'Loading DEM elevations',
      'progress.demDone': 'Elevations ready',
      'progress.osm': 'Loading OpenStreetMap',
      'progress.osmOverpass': 'Loading OSM via Overpass ({current}/{total})',
      'progress.osmParse': 'Parsing buildings and roads',
      'progress.osmTiles': 'OSM API: tile {done}',
      'progress.geometry': 'Building geometry',
      'progress.textures': 'Labels and map overlay',
      'progress.satellite': 'Loading EOX satellite',
      'progress.satelliteFailed': 'Satellite unavailable, using relief',
      'progress.relief': 'Relief texture',
      'progress.texturesDone': 'Textures ready',
      'progress.pack': 'Packing files',
      'progress.done': 'Done',
      'progress.areaTooLarge': 'Area exceeds {max} × {max} km ({area} km²). Reduce the box.',
      'warnings.demTile': 'DEM tile {x}/{y} unavailable',
      'warnings.spacing': 'Terrain step increased to {step} m because of the area size',
      'warnings.osmTiles': 'Part of OSM could not be loaded: {count} tile(s)',
      'warnings.satellite': 'Satellite unavailable: {error}',
      'warning.title': 'Warnings',
      'bytes.b': 'B',
      'bytes.kb': 'KB',
      'bytes.mb': 'MB',
      'bytes.gb': 'GB',
      'km': 'km',
      'm': 'm',
      'error.decode': 'Could not decode image',
      'error.timeout': 'Request timed out',
      'error.osmXml': 'OSM returned invalid XML',
      'error.osmFailed': 'Could not load OSM: {error}'
    }
  };

  let lang = localStorage.getItem(LANG_KEY) || ((navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en');
  if (!STRINGS[lang]) lang = 'ru';

  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS.ru;
    let value = table[key] || STRINGS.ru[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([name, replacement]) => {
        value = value.split('{' + name + '}').join(String(replacement));
      });
    }
    return value;
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.title = t('app.title');
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((element) => {
      element.innerHTML = t(element.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });
    const select = $('langSelect');
    if (select) select.value = lang;
    document.querySelectorAll('#files button').forEach((button) => { button.textContent = t('result.save'); });
    if (state.map.mode === 'select') $('mapHint').textContent = t('map.hint.select');
    else if (!$('mapHint').textContent || state.map.mode === 'pan') $('mapHint').textContent = t('map.hint.pan');
    if (state.info) updateAreaInfo();
    else {
      $('areaPill').textContent = t('area.zero');
      $('bbox').textContent = t('zone.none');
      $('areaHint').textContent = t('zone.hint');
    }
  }

  function setLanguage(next) {
    lang = STRINGS[next] ? next : 'ru';
    try { localStorage.setItem(LANG_KEY, lang); } catch (ignored) {}
    applyLanguage();
  }

  const state = {
    bbox: null,
    info: null,
    busy: false,
    outputs: [],
    groups: [],
    terrain: null,
    hybridCanvas: null,
    preview: null,
    warnings: [],
    map: {
      lat: 47.222, lon: 39.71, zoom: 13,
      width: 0, height: 0,
      mode: 'pan',
      drag: null,
      rect: null,
    },
    previewState: {
      yaw: -0.8, pitch: 0.72, distance: 0,
      pointers: new Map(),
      pinch: 0,
      ready: false,
    },
  };

  const pending = new Map();
  let requestSeq = 0;
  let tileLoadCount = 0;
  let tileErrorCount = 0;

  function nextFrame() {
    return new Promise((resolve) => setTimeout(resolve, 12));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setProgress(value, message) {
    const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
    $('status').hidden = false;
    $('bar').style.width = percent + '%';
    $('percent').textContent = percent + '%';
    if (message) $('statusMsg').textContent = message;
  }

  function setError(message) {
    $('errorMsg').textContent = message || '';
    if (message) $('statusMsg').textContent = t('status.stopped');
  }

  function setBusy(value) {
    state.busy = value;
    $('generateBtn').disabled = value || !state.bbox || !state.info || areaTooLarge(state.info);
  }

  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' ' + t('bytes.gb');
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' ' + t('bytes.mb');
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' ' + t('bytes.kb');
    return bytes + ' ' + t('bytes.b');
  }

  function safeName() {
    const value = ($('name').value || 'zone')
      .replace(/[\/\\:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return value || 'zone';
  }

  function b64ToBytes(base64) {
    const clean = String(base64 || '').replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bytesToB64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function textBytes(text) {
    return new TextEncoder().encode(text);
  }

  function dataUrl(bytes, mime) {
    return `data:${mime || 'application/octet-stream'};base64,${bytesToB64(bytes)}`;
  }

  function loadImage(bytes, mime) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(t('error.decode')));
      image.src = dataUrl(bytes, mime);
    });
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  async function canvasBytes(canvas, mime, quality) {
    const url = canvas.toDataURL(mime, quality);
    return b64ToBytes(url.split(',')[1] || '');
  }

  function request(url, options, binary) {
    const opts = options || {};
    return new Promise((resolve, reject) => {
      if (!window.Android || typeof Android.fetch !== 'function') {
        fetch(url, {
          method: opts.method || 'GET',
          headers: opts.contentType ? { 'Content-Type': opts.contentType } : undefined,
          body: opts.body || undefined,
        }).then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          resolve(binary ? new Uint8Array(await response.arrayBuffer()) : await response.text());
        }).catch(reject);
        return;
      }
      const id = String(++requestSeq);
      const timeoutMs = Math.max(5000, Number(opts.timeout) || 180000);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(t('error.timeout')));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, binary });
      try {
        Android.fetch(id, url, opts.method || 'GET', opts.body || '',
          opts.contentType || '', !!binary);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  function finishRequest(id, ok, status, data) {
    const item = pending.get(id);
    if (!item) return;
    pending.delete(id);
    clearTimeout(item.timer);
    if (!ok) {
      item.reject(new Error(data || `HTTP ${status}`));
      return;
    }
    item.resolve(data);
  }

  window.Native = {
    onText(id, ok, status, text) {
      finishRequest(id, ok, status, text);
    },
    onBinary(id, ok, status, base64) {
      if (!ok) {
        finishRequest(id, false, status, base64);
        return;
      }
      finishRequest(id, true, status, b64ToBytes(base64));
    },
    onError(id, ok, status, message) {
      finishRequest(id, false, status, message);
    },
  };

  function requestText(url, options) {
    return request(url, options, false);
  }

  function requestBytes(url, options) {
    return request(url, options, true);
  }

  function tileWorldX(lon, zoom) {
    return (lon + 180) / 360 * Math.pow(2, zoom) * TILE;
  }

  function tileWorldY(lat, zoom) {
    const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const sin = Math.sin(clamped * RAD);
    return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI))
      * Math.pow(2, zoom) * TILE;
  }

  function worldToLon(x, zoom) {
    return x / (Math.pow(2, zoom) * TILE) * 360 - 180;
  }

  function worldToLat(y, zoom) {
    const n = Math.PI - 2 * Math.PI * y / (Math.pow(2, zoom) * TILE);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  function mapOrigin() {
    return {
      x: tileWorldX(state.map.lon, state.map.zoom) - state.map.width / 2,
      y: tileWorldY(state.map.lat, state.map.zoom) - state.map.height / 2,
    };
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function minValue(values) {
    let result = Infinity;
    for (let i = 0; i < values.length; i++) {
      if (values[i] < result) result = values[i];
    }
    return result;
  }

  function maxValue(values) {
    let result = -Infinity;
    for (let i = 0; i < values.length; i++) {
      if (values[i] > result) result = values[i];
    }
    return result;
  }

  function parseNumber(value) {
    const text = String(value == null ? '' : value).trim().replace(',', '.');
    if (!text) return NaN;
    const number = Number(text);
    return Number.isFinite(number) ? number : NaN;
  }

  function bboxCenter(bbox) {
    return {
      lat: (bbox[0] + bbox[2]) / 2,
      lon: (bbox[1] + bbox[3]) / 2,
    };
  }

  function bboxFromSize(lat, lon, widthKm, heightKm) {
    const mPerLat = 111132.92 - 559.82 * Math.cos(2 * lat * RAD)
      + 1.175 * Math.cos(4 * lat * RAD) - 0.0023 * Math.cos(6 * lat * RAD);
    const mPerLon = 111412.84 * Math.cos(lat * RAD)
      - 93.5 * Math.cos(3 * lat * RAD) + 0.118 * Math.cos(5 * lat * RAD);
    const halfLat = heightKm * 1000 / 2 / mPerLat;
    const halfLon = widthKm * 1000 / 2 / Math.max(1, mPerLon);
    return [lat - halfLat, lon - halfLon, lat + halfLat, lon + halfLon];
  }

  function zoneBbox(lat, lon, widthKm, heightKm) {
    const bbox = bboxFromSize(lat, lon, widthKm, heightKm);
    if (bbox[1] < -180 || bbox[3] > 180) return null;
    return bbox;
  }

  function areaTooLarge(info) {
    const maxSideM = MAX_ZONE_KM * 1000 + 10;
    return info.areaKm2 > MAX_AREA_KM2 + AREA_TOLERANCE_KM2
      || info.width > maxSideM || info.height > maxSideM;
  }

  function readZoneSize() {
    const width = parseNumber($('zoneWidth').value);
    const height = parseNumber($('zoneHeight').value);
    if (!Number.isFinite(width) || !Number.isFinite(height)
        || width < MIN_ZONE_KM || width > MAX_ZONE_KM
        || height < MIN_ZONE_KM || height > MAX_ZONE_KM) {
      return null;
    }
    return { width, height };
  }

  function defaultZoneSize() {
    return readZoneSize() || { width: DEFAULT_ZONE_KM, height: DEFAULT_ZONE_KM };
  }

  function fitZoneZoom(lat, widthKm, heightKm) {
    const widthPx = Math.max(180, state.map.width || 360) * 0.82;
    const heightPx = Math.max(180, state.map.height || 360) * 0.82;
    const metersPerPixel = Math.max(
      widthKm * 1000 / widthPx,
      heightKm * 1000 / heightPx
    );
    const zoom = Math.log2(156543.03392 * Math.cos(lat * RAD) / metersPerPixel);
    return Math.max(3, Math.min(19, Math.floor(zoom)));
  }

  function syncZoneInputs(bbox) {
    if (bbox) {
      const center = bboxCenter(bbox);
      const info = state.info || D.bboxInfo(bbox);
      $('zoneWidth').value = (info.width / 1000).toFixed(2);
      $('zoneHeight').value = (info.height / 1000).toFixed(2);
      $('zoneLat').value = center.lat.toFixed(6);
      $('zoneLon').value = center.lon.toFixed(6);
      return;
    }
    if (!readZoneSize()) {
      $('zoneWidth').value = String(DEFAULT_ZONE_KM);
      $('zoneHeight').value = String(DEFAULT_ZONE_KM);
    }
    $('zoneLat').value = state.map.lat.toFixed(6);
    $('zoneLon').value = state.map.lon.toFixed(6);
  }

  function applyZone() {
    const size = readZoneSize();
    const lat = parseNumber($('zoneLat').value);
    const lon = parseNumber($('zoneLon').value);
    if (!size) {
      $('areaHint').textContent = t('zone.sizeRange', { max: MAX_ZONE_KM });
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)
        || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
      $('areaHint').textContent = t('zone.badCoords');
      return;
    }
    const centerLat = Math.max(-85, Math.min(85, lat));
    const centerLon = Math.max(-179.9, Math.min(179.9, lon));
    const bbox = zoneBbox(centerLat, centerLon, size.width, size.height);
    if (!bbox) {
      $('areaHint').textContent = t('zone.dateline');
      return;
    }
    setMapView(centerLat, centerLon, fitZoneZoom(centerLat, size.width, size.height));
    setBbox(bbox);
    $('mapHint').textContent = t('zone.updated');
  }

  function zoneToMapCenter() {
    const size = defaultZoneSize();
    const bbox = zoneBbox(state.map.lat, state.map.lon, size.width, size.height);
    if (!bbox) {
      $('mapHint').textContent = t('map.hint.dateline');
      return;
    }
    setBbox(bbox);
    $('mapHint').textContent = t('zone.centered');
  }

  function applyZonePreset(size) {
    $('zoneWidth').value = size.toFixed(2);
    $('zoneHeight').value = size.toFixed(2);
    applyZone();
  }

  function updateScaleBar() {
    const width = state.map.width || 360;
    const metersPerPixel = 156543.03392 * Math.cos(state.map.lat * RAD)
      / Math.pow(2, state.map.zoom);
    const target = Math.max(64, Math.min(110, width * 0.2));
    const raw = metersPerPixel * target;
    if (!Number.isFinite(raw) || raw <= 0) return;
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    let distance = power;
    for (const candidate of [power, power * 2, power * 5, power * 10]) {
      if (Math.abs(candidate - raw) < Math.abs(distance - raw)) distance = candidate;
    }
    const pixels = Math.max(20, Math.round(distance / metersPerPixel));
    $('scalebarLine').style.width = pixels + 'px';
    if (distance >= 1000) {
      const km = distance / 1000;
      $('scalebarText').textContent = (km >= 10 ? km.toFixed(0) : km.toFixed(1).replace('.0', '')) + ' ' + t('km');
    } else {
      $('scalebarText').textContent = Math.round(distance) + ' ' + t('m');
    }
  }

  function updateMapMeta() {
    $('mapZoom').textContent = 'z' + state.map.zoom;
    $('mapCoords').textContent = state.map.lat.toFixed(5) + ', ' + state.map.lon.toFixed(5);
    updateScaleBar();
  }

  function applyMapHeight() {
    const map = $('map');
    if (window.innerWidth <= 860) {
      const height = Math.max(300, Math.round(window.innerHeight * 0.46));
      if (map.style.height !== height + 'px') map.style.height = height + 'px';
    } else if (map.style.height) {
      map.style.height = '';
    }
  }

  function resizeMap() {
    applyMapHeight();
    const rect = $('map').getBoundingClientRect();
    state.map.width = Math.max(1, rect.width);
    state.map.height = Math.max(1, rect.height);
    renderMap();
  }

  function renderMap() {
    const map = state.map;
    if (!map.width || !map.height) return;
    const origin = mapOrigin();
    const minX = Math.floor(origin.x / TILE) - 1;
    const maxX = Math.floor((origin.x + map.width) / TILE) + 1;
    const minY = Math.floor(origin.y / TILE) - 1;
    const maxY = Math.floor((origin.y + map.height) / TILE) + 1;
    const count = (maxX - minX + 1) * (maxY - minY + 1);
    if (count > 100) {
      $('mapHint').textContent = t('map.hint.zoom');
    }
    $('tiles').textContent = '';
    tileLoadCount = 0;
    tileErrorCount = 0;
    const z = map.zoom;
    const n = Math.pow(2, z);
    for (let ty = minY; ty <= maxY; ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = minX; tx <= maxX; tx++) {
        const wrapped = ((tx % n) + n) % n;
        const img = document.createElement('img');
        img.alt = '';
        img.className = 'loading';
        img.referrerPolicy = 'no-referrer';
        img.style.left = (tx * TILE - origin.x) + 'px';
        img.style.top = (ty * TILE - origin.y) + 'px';
        const tileUrl = `https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png`;
        const failTile = () => {
          img.classList.remove('loading');
          img.classList.add('error');
          tileErrorCount++;
        };
        img.onload = () => {
          img.classList.remove('loading');
          if (!img.isConnected) return;
          tileLoadCount++;
          $('mapLoading').hidden = true;
        };
        img.onerror = () => {
          if (!img.dataset.bridge && window.Android && typeof Android.fetch === 'function') {
            img.dataset.bridge = '1';
            requestBytes(tileUrl).then((bytes) => {
              img.src = dataUrl(bytes, 'image/png');
            }).catch(() => failTile());
            return;
          }
          failTile();
        };
        img.src = tileUrl;
        $('tiles').appendChild(img);
      }
    }
    $('mapLoading').hidden = false;
    setTimeout(() => {
      if (tileLoadCount === 0 && $('mapLoading')) {
        $('mapLoading').textContent = tileErrorCount
          ? `Карта не загрузилась (${tileErrorCount} тайлов) — проверь интернет`
          : t('map.hint.tileError');
        $('mapLoading').hidden = false;
      } else {
        $('mapLoading').hidden = true;
      }
    }, 5500);
    drawSelection();
    updateMapMeta();
  }

  function drawSelection() {
    const selection = $('selection');
    const tag = $('selectionTag');
    if (!state.bbox) {
      selection.hidden = true;
      selection.classList.remove('ready');
      tag.hidden = true;
      return;
    }
    const origin = mapOrigin();
    const z = state.map.zoom;
    const x1 = tileWorldX(state.bbox[1], z) - origin.x;
    const x2 = tileWorldX(state.bbox[3], z) - origin.x;
    const y1 = tileWorldY(state.bbox[2], z) - origin.y;
    const y2 = tileWorldY(state.bbox[0], z) - origin.y;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    selection.hidden = false;
    selection.classList.add('ready');
    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
    const info = state.info || D.bboxInfo(state.bbox);
    tag.textContent = `${(info.width / 1000).toFixed(2)} × ${(info.height / 1000).toFixed(2)} км · ${info.areaKm2.toFixed(2)} км²`;
    tag.hidden = false;
    const tagWidth = tag.offsetWidth || 170;
    const tagHeight = tag.offsetHeight || 22;
    if (left > state.map.width || top > state.map.height
        || left + width < 0 || top + height < 0) {
      tag.hidden = true;
      return;
    }
    const tagLeft = Math.max(4, Math.min(state.map.width - tagWidth - 4, left + width / 2 - tagWidth / 2));
    const above = top - tagHeight - 6;
    const tagTop = Math.max(4, Math.min(state.map.height - tagHeight - 4, above >= 4 ? above : top + 6));
    tag.style.left = tagLeft + 'px';
    tag.style.top = tagTop + 'px';
  }

  function setMapView(lat, lon, zoom) {
    state.map.lat = lat;
    state.map.lon = lon;
    state.map.zoom = Math.max(3, Math.min(19, zoom));
    renderMap();
  }

  function zoomBy(delta) {
    state.map.zoom = Math.max(3, Math.min(19, state.map.zoom + delta));
    renderMap();
  }

  function mapPoint(event) {
    const rect = $('map').getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(state.map.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(state.map.height, event.clientY - rect.top)),
    };
  }

  function pixelRectFromBbox() {
    const origin = mapOrigin();
    const z = state.map.zoom;
    const x1 = tileWorldX(state.bbox[1], z) - origin.x;
    const x2 = tileWorldX(state.bbox[3], z) - origin.x;
    const y1 = tileWorldY(state.bbox[2], z) - origin.y;
    const y2 = tileWorldY(state.bbox[0], z) - origin.y;
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      right: Math.max(x1, x2),
      bottom: Math.max(y1, y2),
    };
  }

  function pixelRectToBbox(rect) {
    const origin = mapOrigin();
    const z = state.map.zoom;
    const west = worldToLon(origin.x + rect.left, z);
    const east = worldToLon(origin.x + rect.right, z);
    const north = worldToLat(origin.y + rect.top, z);
    const south = worldToLat(origin.y + rect.bottom, z);
    return [
      Math.min(south, north), Math.min(west, east),
      Math.max(south, north), Math.max(west, east),
    ];
  }

  function beginPan(event) {
    const point = mapPoint(event);
    state.map.drag = {
      type: 'pan', id: event.pointerId, startX: point.x, startY: point.y,
      lastX: point.x, lastY: point.y, moved: false,
    };
    $('world').style.transition = 'none';
    $('map').classList.add('dragging');
    try { $('map').setPointerCapture(event.pointerId); } catch (ignored) {}
  }

  function beginMoveZone(event) {
    const point = mapPoint(event);
    state.map.drag = {
      type: 'move', id: event.pointerId, startX: point.x, startY: point.y,
      rect: pixelRectFromBbox(),
    };
    try { $('map').setPointerCapture(event.pointerId); } catch (ignored) {}
  }

  function beginResizeZone(event, handle) {
    const point = mapPoint(event);
    state.map.drag = {
      type: 'resize', id: event.pointerId, handle,
      startX: point.x, startY: point.y, rect: pixelRectFromBbox(),
    };
    try { $('map').setPointerCapture(event.pointerId); } catch (ignored) {}
  }

  function beginSelect(event) {
    const point = mapPoint(event);
    state.map.rect = { startX: point.x, startY: point.y, x: point.x, y: point.y };
    state.map.drag = { type: 'select', id: event.pointerId };
    $('selection').hidden = false;
    $('selection').classList.remove('ready');
    $('selectionTag').hidden = true;
    $('selection').style.left = point.x + 'px';
    $('selection').style.top = point.y + 'px';
    $('selection').style.width = '0px';
    $('selection').style.height = '0px';
    try { $('map').setPointerCapture(event.pointerId); } catch (ignored) {}
  }

  function onPointerDown(event) {
    if (event.target.closest('button')) return;
    if (state.busy) return;
    const handle = state.bbox && state.map.mode !== 'select'
      ? event.target.closest('.zone-handle') : null;
    if (handle) {
      event.preventDefault();
      beginResizeZone(event, handle.dataset.handle);
      return;
    }
    const center = state.bbox && state.map.mode !== 'select'
      ? event.target.closest('.zone-center') : null;
    if (center) {
      event.preventDefault();
      beginMoveZone(event);
      return;
    }
    if (state.bbox && state.map.mode !== 'select'
        && event.target.closest('#selection')) {
      event.preventDefault();
      beginMoveZone(event);
      return;
    }
    if (state.map.mode === 'select') {
      beginSelect(event);
    } else {
      beginPan(event);
    }
  }

  function onPointerMove(event) {
    const drag = state.map.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const point = mapPoint(event);
    if (drag.type === 'pan') {
      drag.lastX = point.x;
      drag.lastY = point.y;
      drag.moved = true;
      $('world').style.transform = `translate3d(${point.x - drag.startX}px, ${point.y - drag.startY}px, 0)`;
    } else if (state.map.rect && drag.type === 'select') {
      const rect = state.map.rect;
      rect.x = point.x;
      rect.y = point.y;
      $('selection').style.left = Math.min(rect.startX, rect.x) + 'px';
      $('selection').style.top = Math.min(rect.startY, rect.y) + 'px';
      $('selection').style.width = Math.abs(rect.x - rect.startX) + 'px';
      $('selection').style.height = Math.abs(rect.y - rect.startY) + 'px';
    } else if (drag.type === 'move' && state.bbox) {
      const width = drag.rect.right - drag.rect.left;
      const height = drag.rect.bottom - drag.rect.top;
      const left = clampNumber(
        drag.rect.left + point.x - drag.startX,
        0, Math.max(0, state.map.width - width)
      );
      const top = clampNumber(
        drag.rect.top + point.y - drag.startY,
        0, Math.max(0, state.map.height - height)
      );
      setBbox(pixelRectToBbox({
        left, top, right: left + width, bottom: top + height,
      }));
    } else if (drag.type === 'resize' && state.bbox) {
      let { left, top, right, bottom } = drag.rect;
      const handle = drag.handle;
      if (handle.includes('n')) {
        top = clampNumber(point.y, 0, bottom - MIN_ZONE_PX);
      }
      if (handle.includes('s')) {
        bottom = clampNumber(point.y, top + MIN_ZONE_PX, state.map.height);
      }
      if (handle.includes('w')) {
        left = clampNumber(point.x, 0, right - MIN_ZONE_PX);
      }
      if (handle.includes('e')) {
        right = clampNumber(point.x, left + MIN_ZONE_PX, state.map.width);
      }
      setBbox(pixelRectToBbox({ left, top, right, bottom }));
    }
  }

  function onPointerUp(event) {
    const drag = state.map.drag;
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.type === 'pan' && drag.moved) {
      const point = mapPoint(event);
      const shiftX = point.x - drag.startX;
      const shiftY = point.y - drag.startY;
      const origin = mapOrigin();
      const centerX = origin.x + state.map.width / 2 - shiftX;
      const centerY = origin.y + state.map.height / 2 - shiftY;
      state.map.lon = worldToLon(centerX, state.map.zoom);
      state.map.lat = worldToLat(centerY, state.map.zoom);
      $('world').style.transform = '';
      renderMap();
      if (!state.bbox) syncZoneInputs(null);
    } else if ((drag.type === 'move' || drag.type === 'resize') && state.bbox) {
      $('mapHint').textContent = t('map.hint.changed');
    } else if (drag.type === 'select' && state.map.rect) {
      const rect = state.map.rect;
      if (Math.abs(rect.x - rect.startX) >= 10 && Math.abs(rect.y - rect.startY) >= 10) {
        const origin = mapOrigin();
        const z = state.map.zoom;
        const lon1 = worldToLon(origin.x + Math.min(rect.startX, rect.x), z);
        const lon2 = worldToLon(origin.x + Math.max(rect.startX, rect.x), z);
        const lat1 = worldToLat(origin.y + Math.min(rect.startY, rect.y), z);
        const lat2 = worldToLat(origin.y + Math.max(rect.startY, rect.y), z);
        setBbox([lat1, Math.min(lon1, lon2), lat2, Math.max(lon1, lon2)]);
        state.map.mode = 'pan';
        $('map').classList.remove('selecting');
        $('selectBtn').classList.remove('active');
      } else {
        drawSelection();
      }
    }
    state.map.drag = null;
    state.map.rect = null;
    $('map').classList.remove('dragging');
    $('world').style.transform = '';
    try { $('map').releasePointerCapture(event.pointerId); } catch (ignored) {}
  }

  function onMapWheel(event) {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1 : -1);
  }

  function updateAreaInfo() {
    const info = state.info;
    if (!info) {
      $('areaPill').textContent = t('area.zero');
      $('areaHint').textContent = t('zone.hint');
      return;
    }
    $('areaPill').textContent = t('area.pill', { area: info.areaKm2.toFixed(2) });
    $('areaPill').classList.toggle('warn', areaTooLarge(info));
    let status;
    if (areaTooLarge(info)) {
      status = info.width > MAX_ZONE_KM * 1000 + 10 || info.height > MAX_ZONE_KM * 1000 + 10
        ? t('area.tooLarge', { max: MAX_ZONE_KM })
        : t('area.reduce', { area: MAX_AREA_KM2 });
    } else {
      status = info.areaKm2 < 0.005 ? t('area.tooSmall') : t('area.ready');
    }
    $('areaHint').textContent = t('area.summary', {
      width: (info.width / 1000).toFixed(2),
      height: (info.height / 1000).toFixed(2),
      status,
    });
  }

  function setBbox(bbox) {
    state.bbox = bbox;
    state.info = D.bboxInfo(bbox);
    $('bbox').textContent = bbox.map((v) => v.toFixed(6)).join(', ');
    updateAreaInfo();
    $('generateBtn').disabled = state.busy || areaTooLarge(state.info) || state.info.areaKm2 < 0.005;
    $('result').hidden = true;
    syncZoneInputs(bbox);
    drawSelection();
  }

  function clearZone() {
    state.bbox = null;
    state.info = null;
    $('bbox').textContent = t('zone.none');
    $('areaPill').textContent = t('area.zero');
    $('areaPill').classList.remove('warn');
    $('areaHint').textContent = t('zone.hint');
    $('generateBtn').disabled = true;
    $('selection').hidden = true;
    $('selection').classList.remove('ready');
    $('selectionTag').hidden = true;
    $('result').hidden = true;
    $('status').hidden = true;
    state.resultSummary = null;
    syncZoneInputs(null);
  }

  async function findPlace() {
    const query = $('search').value.trim();
    if (!query) return;
    const coords = query.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (coords) {
      const lat = parseFloat(coords[1].replace(',', '.'));
      const lon = parseFloat(coords[2].replace(',', '.'));
      if (Math.abs(lat) <= 85 && Math.abs(lon) <= 180) {
        const size = defaultZoneSize();
        const bbox = zoneBbox(lat, lon, size.width, size.height);
        if (!bbox) {
          $('mapHint').textContent = t('map.hint.dateline');
          return;
        }
        setMapView(lat, lon, fitZoneZoom(lat, size.width, size.height));
        setBbox(bbox);
        return;
      }
    }
    $('mapHint').textContent = t('map.hint.searching');
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
        + encodeURIComponent(query);
      const text = await requestText(url);
      const data = JSON.parse(text);
      if (!data.length) {
        $('mapHint').textContent = t('map.hint.notFound');
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)
          || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
        $('mapHint').textContent = t('map.hint.outside');
        return;
      }
      const size = defaultZoneSize();
      const bbox = zoneBbox(lat, lon, size.width, size.height);
      if (!bbox) {
        $('mapHint').textContent = t('map.hint.dateline');
        return;
      }
      setMapView(lat, lon, fitZoneZoom(lat, size.width, size.height));
      setBbox(bbox);
      $('mapHint').textContent = t('map.hint.boxSet');
    } catch (error) {
      $('mapHint').textContent = t('map.hint.searchUnavailable');
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      $('mapHint').textContent = t('map.hint.geoUnavailable');
      return;
    }
    $('mapHint').textContent = t('map.hint.locating');
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)
          || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
        $('mapHint').textContent = t('map.hint.outside');
        return;
      }
      const size = defaultZoneSize();
      const bbox = zoneBbox(lat, lon, size.width, size.height);
      if (!bbox) {
        $('mapHint').textContent = t('map.hint.dateline');
        return;
      }
      setMapView(lat, lon, fitZoneZoom(lat, size.width, size.height));
      setBbox(bbox);
      $('mapHint').textContent = t('map.hint.aroundYou');
    }, () => {
      $('mapHint').textContent = t('map.hint.locateFailed');
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function parseOsm(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error(t('error.osmXml'));
    }
    const nodes = new Map();
    const ways = new Map();
    const relations = new Map();
    const tagsOf = (element) => {
      const tags = {};
      for (const tag of element.getElementsByTagName('tag')) {
        const key = tag.getAttribute('k');
        const value = tag.getAttribute('v');
        if (key) tags[key] = value;
      }
      return tags;
    };
    for (const element of doc.getElementsByTagName('node')) {
      const id = Number(element.getAttribute('id'));
      const lat = Number(element.getAttribute('lat'));
      const lon = Number(element.getAttribute('lon'));
      if (Number.isFinite(id) && Number.isFinite(lat) && Number.isFinite(lon)) {
        nodes.set(id, { id, lat, lon, tags: tagsOf(element) });
      }
    }
    for (const element of doc.getElementsByTagName('way')) {
      const id = Number(element.getAttribute('id'));
      const refs = [];
      for (const nd of element.getElementsByTagName('nd')) {
        const ref = Number(nd.getAttribute('ref'));
        if (Number.isFinite(ref)) refs.push(ref);
      }
      if (Number.isFinite(id)) ways.set(id, { id, refs, tags: tagsOf(element) });
    }
    for (const element of doc.getElementsByTagName('relation')) {
      const id = Number(element.getAttribute('id'));
      const members = [];
      for (const member of element.getElementsByTagName('member')) {
        members.push({
          type: member.getAttribute('type'),
          ref: Number(member.getAttribute('ref')),
          role: member.getAttribute('role') || '',
        });
      }
      if (Number.isFinite(id)) relations.set(id, { id, members, tags: tagsOf(element) });
    }
    return { nodes, ways, relations };
  }

  function wayRefs(way, data = state.osm) {
    if (!way || !data) return [];
    return way.refs.filter((ref) => data.nodes.has(ref));
  }

  function wayCoords(way, data = state.osm) {
    const coords = [];
    for (const ref of wayRefs(way, data)) {
      const node = data.nodes.get(ref);
      coords.push([node.lon, node.lat]);
    }
    return coords;
  }

  function localRing(coords, info, tolerance) {
    const ring = D.cleanRing(coords.map(([lon, lat]) => [info.toX(lon), info.toY(lat)]));
    if (ring.length < 3) return [];
    return D.simplifyRing(ring, tolerance || 0.25);
  }

  function assembleRings(wayIds, data = state.osm) {
    const segments = [];
    for (const id of wayIds) {
      const way = data.ways.get(id);
      if (!way) continue;
      const refs = way.refs.filter((ref) => data.nodes.has(ref));
      if (refs.length >= 2) segments.push(refs);
    }
    const rings = [];
    while (segments.length) {
      let refs = segments.shift().slice();
      let guard = 0;
      while (refs.length >= 2 && refs[0] !== refs[refs.length - 1] && guard++ < 400) {
        const start = refs[0];
        const end = refs[refs.length - 1];
        let found = -1;
        let mode = 0;
        for (let i = 0; i < segments.length; i++) {
          const candidate = segments[i];
          const first = candidate[0];
          const last = candidate[candidate.length - 1];
          if (first === end) { found = i; mode = 1; break; }
          if (last === end) { found = i; mode = 2; break; }
          if (first === start) { found = i; mode = 3; break; }
          if (last === start) { found = i; mode = 4; break; }
        }
        if (found < 0) break;
        const next = segments.splice(found, 1)[0];
        if (mode === 1) refs = refs.concat(next.slice(1));
        else if (mode === 2) refs = refs.concat(next.slice(0, -1).reverse());
        else if (mode === 3) refs = next.slice(1).reverse().concat(refs);
        else refs = next.slice(0, -1).concat(refs);
      }
      if (refs.length >= 4 && refs[0] === refs[refs.length - 1]) {
        const coords = [];
        for (const ref of refs) {
          const node = data.nodes.get(ref);
          if (node) coords.push([node.lon, node.lat]);
        }
        if (coords.length >= 4) rings.push(coords);
      }
    }
    return rings;
  }

  function overpassQuery(info) {
    const b = [info.south, info.west, info.north, info.east]
      .map((value) => value.toFixed(7)).join(',');
    return `[out:xml][timeout:180];
(
  way["building"]({b});
  relation["building"]({b});
  way["highway"]({b});
  way["railway"]({b});
  way["natural"="water"]({b});
  relation["natural"="water"]({b});
  way["landuse"="reservoir"]({b});
  relation["landuse"="reservoir"]({b});
  way["landuse"="basin"]({b});
  relation["landuse"="basin"]({b});
  way["waterway"~"^(river|stream|canal|drain|ditch|brook|riverbank|dock|boatyard)$"]({b});
  relation["type"="multipolygon"]["waterway"="riverbank"]({b});
  node["place"]({b});
);
out body;
>;
out skel qt;`;
  }

  function osmApiUrl(bbox) {
    const b = [bbox.west, bbox.south, bbox.east, bbox.north]
      .map((value) => value.toFixed(7)).join(',');
    return `https://api.openstreetmap.org/api/0.6/map?bbox=${b}`;
  }

  function mergeOsm(target, source) {
    for (const [id, node] of source.nodes) target.nodes.set(id, node);
    for (const [id, way] of source.ways) target.ways.set(id, way);
    for (const [id, relation] of source.relations) target.relations.set(id, relation);
  }

  function splitBbox(bbox) {
    const lat = (bbox.south + bbox.north) / 2;
    const lon = (bbox.west + bbox.east) / 2;
    return [
      { south: bbox.south, west: bbox.west, north: lat, east: lon },
      { south: bbox.south, west: lon, north: lat, east: bbox.east },
      { south: lat, west: bbox.west, north: bbox.north, east: lon },
      { south: lat, west: lon, north: bbox.north, east: bbox.east },
    ];
  }

  async function fetchOsmTiles(info) {
    const maxRequests = 64;
    const queue = [{ bbox: {
      south: info.south, west: info.west, north: info.north, east: info.east,
    }, depth: 0 }];
    const merged = { nodes: new Map(), ways: new Map(), relations: new Map() };
    let requests = 0;
    let accepted = 0;
    let failed = 0;
    let lastError = null;
    while (queue.length && requests < maxRequests) {
      const tile = queue.shift();
      requests += 1;
      setProgress(0.445, t('progress.osmTiles', { done: requests }));
      try {
        const data = parseOsm(await requestText(osmApiUrl(tile.bbox), { timeout: 60000 }));
        mergeOsm(merged, data);
        accepted += 1;
      } catch (error) {
        lastError = error;
        const tooMany = /too many nodes|50000|HTTP 400/i.test(error.message || '');
        if (tooMany && tile.depth < 3) {
          for (const bbox of splitBbox(tile.bbox)) queue.push({ bbox, depth: tile.depth + 1 });
        } else {
          failed += 1;
        }
      }
    }
    if (!accepted) throw lastError || new Error('OSM API');
    if (failed || queue.length) {
      state.warnings.push(t('warnings.osmTiles', { count: failed + queue.length }));
    }
    return merged;
  }

  async function fetchOsm(info) {
    const errors = [];
    let apiError = null;
    if (info.areaKm2 <= 8) {
      try {
        const text = await requestText(osmApiUrl(info), { timeout: 90000 });
        state.osm = parseOsm(text);
        return state.osm;
      } catch (error) {
        apiError = error;
        errors.push('OSM API: ' + (error.message || String(error)));
      }
    }
    const query = overpassQuery(info);
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
    ];
    setProgress(0.44, t('progress.osmOverpass', { current: 1, total: endpoints.length }));
    for (let index = 0; index < endpoints.length; index += 1) {
      const endpoint = endpoints[index];
      setProgress(0.44, t('progress.osmOverpass', {
        current: index + 1, total: endpoints.length,
      }));
      try {
        const text = await requestText(endpoint, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          contentType: 'application/x-www-form-urlencoded',
          timeout: 60000,
        });
        state.osm = parseOsm(text);
        return state.osm;
      } catch (error) {
        const host = endpoint.split('/')[2] || endpoint;
        errors.push(host + ': ' + (error.message || String(error)));
      }
    }
    if (info.areaKm2 <= 12) {
      try {
        state.osm = await fetchOsmTiles(info);
        return state.osm;
      } catch (error) {
        errors.push('OSM API tiles: ' + (error.message || String(error)));
      }
    }
    const details = errors
      .map((value) => value.length > 140 ? value.slice(0, 140) + '…' : value)
      .join('; ');
    throw new Error(t('error.osmFailed', { error: details || (apiError && apiError.message) || 'HTTP' }));
  }

  function extractBuildings(osm, info) {
    const buildings = [];
    const usedByRelation = new Set();
    for (const way of osm.ways.values()) {
      const tags = way.tags || {};
      if (tags.building === 'no' || (!tags.building && !tags['building:part'])) continue;
      const coords = wayCoords(way);
      if (coords.length < 4) continue;
      if (coords[0][0] !== coords[coords.length - 1][0]
        || coords[0][1] !== coords[coords.length - 1][1]) coords.push(coords[0]);
      const ring = localRing(coords, info, 0.25);
      if (ring.length < 3 || Math.abs(D.signedArea(ring)) < 4) continue;
      buildings.push({ rings: [ring], height: D.buildingHeight(tags), tags, id: 'way/' + way.id });
    }
    for (const relation of osm.relations.values()) {
      const tags = relation.tags || {};
      if (tags.building === 'no' || (!tags.building && !tags['building:part'])) continue;
      const outerIds = relation.members
        .filter((member) => member.type === 'way' && member.role !== 'inner')
        .map((member) => member.ref);
      const rings = assembleRings(outerIds);
      if (!rings.length) continue;
      for (const id of outerIds) usedByRelation.add(id);
      const height = D.buildingHeight(tags);
      for (const coords of rings) {
        if (coords.length < 4) continue;
        const ring = localRing(coords, info, 0.25);
        if (ring.length < 3 || Math.abs(D.signedArea(ring)) < 4) continue;
        buildings.push({ rings: [ring], height, tags, id: 'relation/' + relation.id });
      }
    }
    if (usedByRelation.size) {
      return buildings.filter((building) => {
        if (!building.id.startsWith('way/')) return true;
        return !usedByRelation.has(Number(building.id.slice(4)));
      });
    }
    return buildings;
  }

  function extractRoads(osm, info) {
    const roads = [];
    const allowed = new Set(Object.keys(D.ROAD_STYLES));
    for (const way of osm.ways.values()) {
      const tags = way.tags || {};
      let kind = null;
      if (tags.highway && allowed.has(tags.highway)) kind = tags.highway;
      else if (tags.railway && ['rail', 'tram', 'light_rail', 'subway', 'narrow_gauge'].includes(tags.railway)) kind = 'rail';
      if (!kind) continue;
      const coords = wayCoords(way);
      if (coords.length < 2) continue;
      const local = [];
      for (const [lon, lat] of coords) {
        const x = info.toX(lon), y = info.toY(lat);
        if (x < info.xMin - 80 || x > info.xMax + 80 || y < info.yMin - 80 || y > info.yMax + 80) continue;
        if (!local.length || Math.hypot(x - local[local.length - 1][0], y - local[local.length - 1][1]) > 0.2) {
          local.push([x, y]);
        }
      }
      if (local.length < 2) continue;
      const style = D.ROAD_STYLES[kind] || D.ROAD_STYLES.rail;
      roads.push({ kind, width: style.width, coords: local, tags });
    }
    return roads;
  }

  const WATER_WIDTHS = {
    river: 12, stream: 4, canal: 8, drain: 2.5, ditch: 2, brook: 3,
  };

  function isWaterArea(tags) {
    return tags.natural === 'water' || tags.natural === 'riverbank'
      || tags.waterway === 'riverbank' || tags.waterway === 'dock'
      || tags.waterway === 'boatyard'
      || tags.landuse === 'reservoir' || tags.landuse === 'basin';
  }

  function isWaterLine(tags) {
    return !!WATER_WIDTHS[tags.waterway] && !isWaterArea(tags);
  }

  function waterWidth(tags) {
    const parsed = parseFloat(String(tags.width || '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 500
      ? parsed : (WATER_WIDTHS[tags.waterway] || 4);
  }

  function bufferLine(coords, width) {
    if (!coords || coords.length < 2) return [];
    const half = width / 2;
    const left = [], right = [];
    for (let i = 0; i < coords.length; i++) {
      const current = coords[i];
      const prev = coords[Math.max(0, i - 1)];
      const next = coords[Math.min(coords.length - 1, i + 1)];
      const direction = (a, b) => {
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const length = Math.hypot(dx, dy);
        if (length < 1e-9) return null;
        return [dx / length, dy / length];
      };
      const first = direction(prev, current) || direction(current, next) || [1, 0];
      const second = direction(current, next) || first;
      const n1 = [-first[1], first[0]];
      const n2 = [-second[1], second[0]];
      let mx = n1[0] + n2[0], my = n1[1] + n2[1];
      const length = Math.hypot(mx, my);
      if (length < 1e-9) {
        mx = n1[0];
        my = n1[1];
      } else {
        mx /= length;
        my /= length;
      }
      const dot = Math.max(0.25, Math.abs(mx * n1[0] + my * n1[1]));
      const scale = Math.min(half * 3, half / dot);
      left.push([current[0] + mx * scale, current[1] + my * scale]);
      right.push([current[0] - mx * scale, current[1] - my * scale]);
    }
    return left.concat(right.reverse());
  }

  function extractWater(osm, info) {
    const water = [];
    const usedByRelation = new Set();
    for (const way of osm.ways.values()) {
      const tags = way.tags || {};
      if (!isWaterArea(tags) && !isWaterLine(tags)) continue;
      const coords = wayCoords(way, osm);
      if (coords.length < 2) continue;
      if (isWaterArea(tags)) {
        if (coords.length < 4) continue;
        if (coords[0][0] !== coords[coords.length - 1][0]
          || coords[0][1] !== coords[coords.length - 1][1]) coords.push(coords[0]);
        const ring = localRing(coords, info, 0.25);
        if (ring.length >= 3 && Math.abs(D.signedArea(ring)) >= 1) {
          water.push({ outer: ring, holes: [], tags, id: 'way/' + way.id });
        }
      } else {
        const local = [];
        for (const [lon, lat] of coords) {
          const x = info.toX(lon), y = info.toY(lat);
          if (x < info.xMin - 200 || x > info.xMax + 200
            || y < info.yMin - 200 || y > info.yMax + 200) continue;
          local.push([x, y]);
        }
        const ring = bufferLine(local, waterWidth(tags));
        if (ring.length >= 3) {
          water.push({ outer: ring, holes: [], tags, id: 'way/' + way.id });
        }
      }
    }
    for (const relation of osm.relations.values()) {
      const tags = relation.tags || {};
      if (!isWaterArea(tags)) continue;
      const outerIds = relation.members
        .filter((member) => member.type === 'way' && member.role !== 'inner')
        .map((member) => member.ref);
      const innerIds = relation.members
        .filter((member) => member.type === 'way' && member.role === 'inner')
        .map((member) => member.ref);
      const outerRings = assembleRings(outerIds, osm)
        .map((coords) => localRing(coords, info, 0.25))
        .filter((ring) => ring.length >= 3);
      const innerRings = assembleRings(innerIds, osm)
        .map((coords) => localRing(coords, info, 0.25))
        .filter((ring) => ring.length >= 3);
      if (!outerRings.length) continue;
      for (const id of outerIds.concat(innerIds)) usedByRelation.add(id);
      for (const outer of outerRings) {
        const holes = innerRings.filter((hole) => D.pointInRing(hole[0], outer));
        water.push({ outer, holes, tags, id: 'relation/' + relation.id });
      }
    }
    if (!usedByRelation.size) return water;
    return water.filter((body) => {
      if (!body.id.startsWith('way/')) return true;
      return !usedByRelation.has(Number(body.id.slice(4)));
    });
  }

  function extractPlaces(osm, info) {
    const places = [];
    for (const node of osm.nodes.values()) {
      const tags = node.tags || {};
      const name = (tags.name || '').trim();
      if (!name || !tags.place) continue;
      const x = info.toX(node.lon), y = info.toY(node.lat);
      if (x < info.xMin || x > info.xMax || y < info.yMin || y > info.yMax) continue;
      places.push({
        name, kind: tags.place, x, y,
        population: Number(tags.population || 0) || 0,
      });
    }
    const order = { city: 0, town: 1, village: 2, hamlet: 3, suburb: 4, neighbourhood: 5 };
    places.sort((a, b) => (order[a.kind] === undefined ? 9 : order[a.kind]) - (order[b.kind] === undefined ? 9 : order[b.kind]) || b.population - a.population);
    return places;
  }

  function demZoom(info, spacing) {
    const base = 156543.03392 * Math.cos(info.lat0 * RAD);
    let zoom = D.clamp(Math.round(Math.log2(base / Math.max(5, spacing))) + 1, 11, 15);
    while (zoom > 10) {
      const x0 = Math.floor(tileWorldX(info.west, zoom) / TILE);
      const x1 = Math.floor(tileWorldX(info.east, zoom) / TILE);
      const y0 = Math.floor(tileWorldY(info.north, zoom) / TILE);
      const y1 = Math.floor(tileWorldY(info.south, zoom) / TILE);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_DEM_TILES) break;
      zoom--;
    }
    return zoom;
  }

  async function buildTerrain(info, spacing, options) {
    const zoom = demZoom(info, spacing);
    const x0 = Math.floor(tileWorldX(info.west, zoom) / TILE);
    const x1 = Math.floor(tileWorldX(info.east, zoom) / TILE);
    const y0 = Math.floor(tileWorldY(info.north, zoom) / TILE);
    const y1 = Math.floor(tileWorldY(info.south, zoom) / TILE);
    const cols = x1 - x0 + 1;
    const rows = y1 - y0 + 1;
    const canvas = makeCanvas(cols * TILE, rows * TILE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#800000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let loaded = 0;
    const total = cols * rows;
    setProgress(0.08, t('progress.dem'));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        try {
          const bytes = await requestBytes(
            `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tx}/${ty}.png`
          );
          const image = await loadImage(bytes, 'image/png');
          context.drawImage(image, (tx - x0) * TILE, (ty - y0) * TILE);
        } catch (error) {
          state.warnings.push(t('warnings.demTile', { x: tx, y: ty }));
        }
        loaded++;
        setProgress(0.08 + 0.27 * loaded / total, t('progress.dem'));
        await nextFrame();
      }
    }
    let pixels;
    try {
      pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (error) {
      pixels = null;
    }
    const sample = (lon, lat) => {
      if (!pixels) return 0;
      let px = tileWorldX(lon, zoom) - x0 * TILE;
      let py = tileWorldY(lat, zoom) - y0 * TILE;
      px = Math.max(0, Math.min(canvas.width - 1, px));
      py = Math.max(0, Math.min(canvas.height - 1, py));
      const ix = Math.floor(px), iy = Math.floor(py);
      const fx = px - ix, fy = py - iy;
      const get = (x, y) => {
        const index = (y * canvas.width + x) * 4;
        return (pixels[index] * 256 + pixels[index + 1] + pixels[index + 2] / 256) - 32768;
      };
      const a = get(ix, iy), b = get(Math.min(canvas.width - 1, ix + 1), iy);
      const c = get(ix, Math.min(canvas.height - 1, iy + 1));
      const d = get(Math.min(canvas.width - 1, ix + 1), Math.min(canvas.height - 1, iy + 1));
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    };
    let adjusted = spacing;
    while (true) {
      const nx = D.clamp(Math.ceil(info.width / adjusted) + 1, 2, 420);
      const ny = D.clamp(Math.ceil(info.height / adjusted) + 1, 2, 420);
      if (nx * ny <= MAX_TERRAIN_CELLS) break;
      adjusted *= 1.25;
    }
    const nx = D.clamp(Math.ceil(info.width / adjusted) + 1, 2, 420);
    const ny = D.clamp(Math.ceil(info.height / adjusted) + 1, 2, 420);
    const xs = [], ys = [], z = [];
    for (let j = 0; j < ny; j++) {
      const y = info.yMin + (info.yMax - info.yMin) * j / (ny - 1);
      ys.push(y);
      for (let i = 0; i < nx; i++) {
        const x = info.xMin + (info.xMax - info.xMin) * i / (nx - 1);
        if (xs[i] === undefined) xs[i] = x;
        const lon = info.toLon(x);
        const lat = info.toLat(y);
        const height = sample(lon, lat);
        z.push(Number.isFinite(height) ? height : 0);
      }
    }
    const baseElevation = minValue(z);
    const terrain = {
      nx, ny, xs, ys, z, baseElevation,
      xMin: info.xMin, xMax: info.xMax, yMin: info.yMin, yMax: info.yMax,
      info, spacing: adjusted,
    };
    if (adjusted !== spacing) state.warnings.push(t('warnings.spacing', { step: Math.round(adjusted) }));
    setProgress(0.42, t('progress.demDone'));
    return terrain;
  }

  function smoothTerrain(terrain, passes) {
    if (passes <= 0) return;
    const nx = terrain.nx;
    const ny = terrain.ny;
    let source = terrain.z;
    for (let pass = 0; pass < passes; pass++) {
      const output = new Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          let sum = 0;
          let count = 0;
          for (let dj = -1; dj <= 1; dj++) {
            const y = j + dj;
            if (y < 0 || y >= ny) continue;
            for (let di = -1; di <= 1; di++) {
              const x = i + di;
              if (x < 0 || x >= nx) continue;
              sum += source[y * nx + x];
              count++;
            }
          }
          output[j * nx + i] = sum / count;
        }
      }
      source = output;
    }
    terrain.z = source;
  }

  function applyTerrainSettings(terrain, options) {
    smoothTerrain(terrain, options.smoothing);
    const factor = clampNumber(options.heightScale, 0.5, 3);
    if (factor !== 1) {
      let sum = 0;
      for (let i = 0; i < terrain.z.length; i++) sum += terrain.z[i];
      const mean = sum / Math.max(1, terrain.z.length);
      for (let i = 0; i < terrain.z.length; i++) {
        terrain.z[i] = mean + (terrain.z[i] - mean) * factor;
      }
    }
    terrain.baseElevation = minValue(terrain.z);
    return terrain;
  }

  function mapPixel(x, y, info, size) {
    return [
      (x - info.xMin) / Math.max(1e-9, info.xMax - info.xMin) * size,
      (info.yMax - y) / Math.max(1e-9, info.yMax - info.yMin) * size,
    ];
  }

  function drawWater(ctx, water, info, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4a8cb4';
    for (const body of water || []) {
      const rings = [body.outer, ...(body.holes || [])];
      ctx.beginPath();
      for (const ring of rings) {
        if (!ring || ring.length < 3) continue;
        for (let i = 0; i < ring.length; i++) {
          const [px, py] = mapPixel(ring[i][0], ring[i][1], info, size);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
    ctx.globalAlpha = 1;
  }

  function drawRoads(ctx, roads, info, size, alpha) {
    const metersPerPx = (info.xMax - info.xMin) / size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const road of roads) {
      const style = D.ROAD_STYLES[road.kind] || D.ROAD_STYLES.rail;
      ctx.strokeStyle = style.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(0.8, road.width / Math.max(0.01, metersPerPx));
      ctx.beginPath();
      for (let i = 0; i < road.coords.length; i++) {
        const [px, py] = mapPixel(road.coords[i][0], road.coords[i][1], info, size);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBuildingOutlines(ctx, buildings, info, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(220,220,210,.65)';
    ctx.lineWidth = Math.max(1, size / 2048);
    for (const building of buildings) {
      for (const ring of building.rings) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const [px, py] = mapPixel(ring[i][0], ring[i][1], info, size);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels(ctx, places, roads, info, size) {
    const boxes = [];
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const place of places.slice(0, 80)) {
      const [px, py] = mapPixel(place.x, place.y, info, size);
      if (px < 0 || py < 0 || px > size || py > size) continue;
      const sizes = { city: 0.011, town: 0.009, village: 0.0075, hamlet: 0.0065, suburb: 0.006, neighbourhood: 0.0055 };
      const fontSize = Math.max(9, Math.min(32, size * (sizes[place.kind] || 0.006)));
      const bold = place.kind === 'city' || place.kind === 'town';
      ctx.font = (bold ? '700 ' : '600 ') + fontSize + 'px sans-serif';
      const width = ctx.measureText(place.name).width;
      const box = [px - width / 2 - 4, py - fontSize / 2 - 3, px + width / 2 + 4, py + fontSize / 2 + 3];
      if (boxes.some((other) => box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1])) continue;
      boxes.push(box);
      ctx.strokeStyle = 'rgba(4,9,7,.92)';
      ctx.lineWidth = Math.max(2, fontSize / 4);
      ctx.strokeText(place.name, px - width / 2, py);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(place.name, px - width / 2, py);
    }
    const seen = new Set();
    for (const road of roads) {
      if (!road.tags.name || seen.has(road.tags.name)) continue;
      const major = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(road.kind);
      if (!major || road.coords.length < 2) continue;
      seen.add(road.tags.name);
      const index = Math.floor(road.coords.length / 2);
      const [px, py] = mapPixel(road.coords[index][0], road.coords[index][1], info, size);
      if (px < 0 || py < 0 || px > size || py > size) continue;
      const fontSize = Math.max(8, Math.min(18, size * 0.0045));
      ctx.font = '600 ' + fontSize + 'px sans-serif';
      ctx.strokeStyle = 'rgba(4,9,7,.9)';
      ctx.lineWidth = Math.max(2, fontSize / 4);
      ctx.strokeText(road.tags.name, px + 5, py + 5);
      ctx.fillStyle = 'rgba(250,250,245,.96)';
      ctx.fillText(road.tags.name, px + 5, py + 5);
    }
  }

  function buildTextureCanvases(info, buildings, roads, places, size, useLabels, water) {
    const labels = makeCanvas(size, size);
    const labelsCtx = labels.getContext('2d');
    labelsCtx.fillStyle = '#1a2420';
    labelsCtx.fillRect(0, 0, size, size);
    drawWater(labelsCtx, water, info, size, 0.95);
    drawRoads(labelsCtx, roads, info, size, 0.9);
    drawBuildingOutlines(labelsCtx, buildings, info, size, 0.35);
    if (useLabels) drawLabels(labelsCtx, places, roads, info, size);

    const overlay = makeCanvas(size, size);
    const overlayCtx = overlay.getContext('2d');
    drawWater(overlayCtx, water, info, size, 0.7);
    drawRoads(overlayCtx, roads, info, size, 0.9);
    drawBuildingOutlines(overlayCtx, buildings, info, size, 0.35);
    if (useLabels) drawLabels(overlayCtx, places, roads, info, size);

    return { labels, overlay };
  }

  function mercatorX(lon) {
    return lon * 20037508.34 / 180;
  }

  function mercatorY(lat) {
    return Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 20037508.34 / Math.PI;
  }

  function imageIsBlank(image) {
    try {
      const probe = makeCanvas(8, 8);
      const context = probe.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 8, 8);
      const data = context.getImageData(0, 0, 8, 8).data;
      let low = 255, high = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.max(data[i], data[i + 1], data[i + 2]);
        low = Math.min(low, value);
        high = Math.max(high, value);
        total += value;
      }
      return high - low < 3 || total / (data.length / 4) < 4;
    } catch (error) {
      return false;
    }
  }

  async function fetchSatellite(info, size) {
    const requestSize = Math.min(2048, size);
    const halfW = Math.max(1, Math.floor(requestSize / 2));
    const halfH = Math.max(1, Math.floor(requestSize / 2));
    const widths = [halfW, requestSize - halfW];
    const heights = [halfH, requestSize - halfH];
    const x1 = mercatorX(info.west), y1 = mercatorY(info.south);
    const x2 = mercatorX(info.east), y2 = mercatorY(info.north);
    const xs = [x1, (x1 + x2) / 2, x2];
    const ys = [y2, (y1 + y2) / 2, y1];
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#18231f';
    ctx.fillRect(0, 0, size, size);
    const loaded = [];
    const missing = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const w = widths[col], h = heights[row];
        const px = col ? widths[0] : 0;
        const py = row ? heights[0] : 0;
        const params = new URLSearchParams({
          SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0',
          LAYERS: 's2cloudless-2025_3857', STYLES: '', CRS: 'EPSG:3857',
          BBOX: `${xs[col].toFixed(3)},${ys[row + 1].toFixed(3)},${xs[col + 1].toFixed(3)},${ys[row].toFixed(3)}`,
          WIDTH: String(w), HEIGHT: String(h), FORMAT: 'image/jpeg',
        });
        let image = null;
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const bytes = await requestBytes('https://tiles.maps.eox.at/wms?' + params.toString(), { timeout: 90000 });
            const candidate = await loadImage(bytes, 'image/jpeg');
            if (imageIsBlank(candidate)) throw new Error('EOX WMS: пустой тайл');
            image = candidate;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await sleep(1000 * (attempt + 1));
          }
        }
        if (image) {
          loaded.push({ image, px, py, w, h });
          ctx.drawImage(image, px, py, w, h);
        } else {
          missing.push({ px, py, w, h, error: lastError });
        }
      }
    }
    if (!loaded.length) throw new Error('EOX WMS: все тайлы недоступны после 3 попыток');
    for (const tile of missing) {
      const nearest = loaded.reduce((best, item) => {
        const distance = (item.px - tile.px) ** 2 + (item.py - tile.py) ** 2;
        return distance < best.distance ? { item, distance } : best;
      }, { item: loaded[0], distance: Infinity }).item;
      ctx.drawImage(nearest.image, tile.px, tile.py, tile.w, tile.h);
    }
    return canvas;
  }

  function renderRelief(terrain, size) {
    const work = Math.min(1024, size);
    const canvas = makeCanvas(work, work);
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(work, work);
    const data = image.data;
    const low = [78, 104, 68];
    const high = [181, 164, 132];
    const zMin = minValue(terrain.z);
    const zMax = maxValue(terrain.z);
    for (let py = 0; py < work; py++) {
      for (let px = 0; px < work; px++) {
        const x = terrain.xMin + (terrain.xMax - terrain.xMin) * px / (work - 1);
        const y = terrain.yMax - (terrain.yMax - terrain.yMin) * py / (work - 1);
        const z = D.sampleTerrain(terrain, x, y);
        const dx = (D.sampleTerrain(terrain, x + 2, y) - D.sampleTerrain(terrain, x - 2, y)) / 4;
        const dy = (D.sampleTerrain(terrain, x, y + 2) - D.sampleTerrain(terrain, x, y - 2)) / 4;
        let shade = 0.62 + (-dx * 0.8 - dy * 0.8) * 0.035;
        shade = D.clamp(shade, 0.25, 1.15);
        const norm = D.clamp((z - zMin) / Math.max(1e-9, zMax - zMin), 0, 1);
        const index = (py * work + px) * 4;
        data[index] = D.clamp((low[0] + (high[0] - low[0]) * norm) * shade, 0, 255);
        data[index + 1] = D.clamp((low[1] + (high[1] - low[1]) * norm) * shade, 0, 255);
        data[index + 2] = D.clamp((low[2] + (high[2] - low[2]) * norm) * shade, 0, 255);
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    if (work !== size) {
      const target = makeCanvas(size, size);
      target.getContext('2d').drawImage(canvas, 0, 0, size, size);
      return target;
    }
    return canvas;
  }

  async function buildTextures(info, terrain, buildings, roads, places, options, water) {
    setProgress(0.5, t('progress.textures'));
    const size = options.textureSize;
    const canvases = buildTextureCanvases(info, buildings, roads, places, size, options.labels, water);
    let satellite = null;
    if (options.satellite) {
      setProgress(0.56, t('progress.satellite'));
      try {
        satellite = await fetchSatellite(info, size);
      } catch (error) {
        state.warnings.push(t('warnings.satellite', { error: error.message }));
        setProgress(0.58, t('progress.satelliteFailed'));
      }
    }
    let base = satellite || renderRelief(terrain, size);
    if (!satellite) setProgress(0.6, t('progress.relief'));
    const hybrid = makeCanvas(size, size);
    const hybridCtx = hybrid.getContext('2d');
    hybridCtx.drawImage(base, 0, 0, size, size);
    hybridCtx.drawImage(canvases.overlay, 0, 0);
    setProgress(0.65, t('progress.texturesDone'));
    return {
      labels: canvases.labels,
      overlay: canvases.overlay,
      base,
      hybrid,
      satellite,
    };
  }

  function makeHeightmap(terrain) {
    const work = Math.min(1024, Math.max(terrain.nx, terrain.ny));
    const canvas = makeCanvas(work, work);
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(work, work);
    const zMin = minValue(terrain.z);
    const zMax = maxValue(terrain.z);
    for (let py = 0; py < work; py++) {
      for (let px = 0; px < work; px++) {
        const x = terrain.xMin + (terrain.xMax - terrain.xMin) * px / (work - 1);
        const y = terrain.yMax - (terrain.yMax - terrain.yMin) * py / (work - 1);
        const z = D.sampleTerrain(terrain, x, y);
        const value = Math.round(D.clamp((z - zMin) / Math.max(1e-9, zMax - zMin), 0, 1) * 255);
        const index = (py * work + px) * 4;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function buildOutputs(name, info, terrain, groups, textures, texturesBytes, heightmapCanvas, metaText) {
    const outputs = [];
    const addText = (path, mime, text) => outputs.push({ path, mime, data: text, size: textBytes(text).length });
    const addBytes = (path, mime, bytes) => outputs.push({ path, mime, data: bytes, size: bytes.length });
    addText(`${name}/${name}.obj`, 'application/octet-stream', buildObjFor(groups, name));
    addText(`${name}/${name}.mtl`, 'application/octet-stream', buildMtlFor(name));
    addBytes(`${name}/${name}.glb`, 'model/gltf-binary', D.buildGlb(groups, texturesBytes, 'image/jpeg'));
    addBytes(`${name}/heightmap.png`, 'image/png', heightmapCanvas ? heightmapCanvas.__bytes : new Uint8Array());
    addText(`${name}/meta.json`, 'application/json', metaText);
    addBytes(`${name}/textures/labels.png`, 'image/png', textures.labelsBytes);
    addBytes(`${name}/textures/labels_overlay.png`, 'image/png', textures.overlayBytes);
    addBytes(`${name}/hybrid.jpg`, 'image/jpeg', textures.hybridBytes);
    addBytes(`${name}/textures/hybrid.jpg`, 'image/jpeg', textures.hybridBytes);
    if (textures.satelliteBytes) addBytes(`${name}/textures/satellite.jpg`, 'image/jpeg', textures.satelliteBytes);
    if (textures.reliefBytes) addBytes(`${name}/textures/relief.jpg`, 'image/jpeg', textures.reliefBytes);
    return outputs;
  }

  function buildObjFor(groups, name) {
    const texture = 'hybrid.jpg';
    return D.buildObj(groups, { name, texture }).obj;
  }

  function buildMtlFor(name) {
    const terrain = `terrain_hybrid`;
    return [
      `newmtl ${terrain}`,
      'Ka 1.000 1.000 1.000', 'Kd 1.000 1.000 1.000', 'Ks 0 0 0', 'd 1.0', 'illum 1',
      'map_Kd hybrid.jpg', '',
      'newmtl building',
      'Kd 0.560 0.560 0.560', 'Ks 0 0 0', 'd 1.0', 'illum 1', '',
      'newmtl road',
      'Kd 0.230 0.230 0.235', 'Ks 0 0 0', 'd 1.0', 'illum 1', '',
      'newmtl rail',
      'Kd 0.230 0.170 0.130', 'Ks 0 0 0', 'd 1.0', 'illum 1', '',
      'newmtl water',
      'Kd 0.200 0.460 0.650', 'Ks 0 0 0', 'd 1.0', 'illum 1', '',
    ].join('\n') + '\n';
  }

  function countTriangles(groups) {
    return groups.reduce((sum, group) => sum + Math.floor(group.indices.length / 3), 0);
  }

  function makeMeta(name, info, terrain, groups, buildings, roads, water, textures, outputs, options) {
    return JSON.stringify({
      name,
      generator: '3Dmaps standalone 0.2.11',
      bbox: [info.south, info.west, info.north, info.east],
      area_km2: Number(info.areaKm2.toFixed(4)),
      terrain_spacing: Number(terrain.spacing.toFixed(2)),
      height_scale: Number(options.heightScale.toFixed(2)),
      smoothing: options.smoothing,
      texture_size: options.textureSize,
      grid: {
        nx: terrain.nx, ny: terrain.ny,
        min_height: Number(minValue(terrain.z).toFixed(2)),
        max_height: Number(maxValue(terrain.z).toFixed(2)),
        base_elevation: Number(terrain.baseElevation.toFixed(2)),
      },
      counts: {
        buildings: buildings.length,
        roads: roads.filter((road) => road.kind !== 'rail').length,
        railways: roads.filter((road) => road.kind === 'rail').length,
        water: water.length,
        triangles: countTriangles(groups),
      },
      warnings: state.warnings,
      sources: [
        'OpenStreetMap contributors, ODbL 1.0',
        'Terrarium DEM, Mapzen/Tilezen',
        textures.satellite ? 'Sentinel-2 cloudless, EOX IT Services, CC BY-NC-SA 4.0' : 'relief texture generated locally',
      ],
      files: outputs.filter((item) => !item.path.endsWith('/meta.json'))
        .map((item) => ({ name: item.path.split('/').pop(), size: item.size })),
    }, null, 2);
  }

  async function generate() {
    if (!state.bbox || !state.info || state.busy) return;
    if (areaTooLarge(state.info)) {
      setError(t('progress.areaTooLarge', { max: MAX_ZONE_KM, area: MAX_AREA_KM2 }));
      return;
    }
    state.busy = true;
    state.warnings = [];
    state.outputs = [];
    state.groups = [];
    state.hybridCanvas = null;
    state.resultSummary = null;
    $('result').hidden = true;
    $('previewWrap').hidden = true;
    $('status').hidden = false;
    $('errorMsg').textContent = '';
    $('saveAllBtn').disabled = true;
    $('saveGlbBtn').disabled = true;
    $('saveObjBtn').disabled = true;
    setBusy(true);
    $('statusTitle').textContent = t('status.generating');
    setProgress(0.02, t('progress.checkZone'));
    try {
      const info = state.info;
      const spacing = parseFloat($('spacing').value);
      const textureSize = Math.min(2048, Math.max(512, parseInt($('texture').value, 10) || 2048));
      const heightScale = clampNumber(parseFloat($('heightScale').value) || 1, 0.5, 3);
      const smoothing = Math.max(0, Math.min(2, parseInt($('smoothing').value, 10) || 0));
      const options = {
        satellite: $('satellite').checked,
        labels: $('labels').checked,
        buildings: $('buildings').checked,
        roads: $('roads').checked,
        railways: $('railways').checked,
        water: $('water').checked,
        textureSize,
        spacing,
        heightScale,
        smoothing,
      };
      const name = safeName();
      const terrain = applyTerrainSettings(await buildTerrain(info, spacing, options), options);
      state.terrain = terrain;
      setProgress(0.43, t('progress.osm'));
      await nextFrame();
      const osm = await fetchOsm(info);
      setProgress(0.47, t('progress.osmParse'));
      await nextFrame();
      const buildings = options.buildings ? extractBuildings(osm, info) : [];
      let roads = options.roads || options.railways ? extractRoads(osm, info) : [];
      if (!options.roads) roads = roads.filter((road) => road.kind === 'rail');
      if (!options.railways) roads = roads.filter((road) => road.kind !== 'rail');
      const water = options.water ? extractWater(osm, info) : [];
      const places = extractPlaces(osm, info);
      setProgress(0.49, t('progress.geometry'));
      await nextFrame();
      const groups = [D.terrainMesh(terrain)];
      if (water.length) groups.push(D.waterMesh(water, terrain));
      if (buildings.length) groups.push(D.buildingMesh(buildings, terrain));
      groups.push(...D.roadMesh(roads, terrain));
      state.groups = groups;
      const textureCanvases = await buildTextures(info, terrain, buildings, roads, places, options, water);
      setProgress(0.7, t('progress.pack'));
      const labelsBytes = await canvasBytes(textureCanvases.labels, 'image/png');
      const overlayBytes = await canvasBytes(textureCanvases.overlay, 'image/png');
      const hybridBytes = await canvasBytes(textureCanvases.hybrid, 'image/jpeg', 0.9);
      const satelliteBytes = textureCanvases.satellite
        ? await canvasBytes(textureCanvases.satellite, 'image/jpeg', 0.9) : null;
      const reliefBytes = textureCanvases.satellite
        ? null : await canvasBytes(textureCanvases.base, 'image/jpeg', 0.9);
      const heightmap = makeHeightmap(terrain);
      heightmap.__bytes = await canvasBytes(heightmap, 'image/png');
      const textures = {
        labelsBytes, overlayBytes, hybridBytes, satelliteBytes, reliefBytes,
        labels: textureCanvases.labels,
      };
      const outputs = buildOutputs(name, info, terrain, groups, textures, hybridBytes, heightmap, '');
      const meta = makeMeta(name, info, terrain, groups, buildings, roads, water, textures, outputs, options);
      const metaItem = outputs.find((item) => item.path.endsWith('/meta.json'));
      metaItem.data = meta;
      metaItem.size = textBytes(meta).length;
      state.outputs = outputs;
      state.hybridCanvas = textureCanvases.hybrid;
      setProgress(0.88, t('progress.done'));
      showResult(groups, outputs, terrain, buildings, roads, water);
      setProgress(1, t('progress.done'));
      $('statusTitle').textContent = t('status.done');
    } catch (error) {
      console.error(error);
      setError(error.message || String(error));
      state.warnings.push(error.message || String(error));
    } finally {
      state.busy = false;
      setBusy(false);
    }
  }

  function showResult(groups, outputs, terrain, buildings, roads, water) {
    $('result').hidden = false;
    state.resultSummary = {
      area: state.info.areaKm2,
      triangles: groups.reduce((sum, group) => sum + Math.floor(group.indices.length / 3), 0),
      buildings: buildings.length,
      roads: roads.length,
      water: water.length,
    };
    renderResultSummary();
    const files = $('files');
    files.textContent = '';
    for (const item of outputs) {
      const row = document.createElement('div');
      row.className = 'file';
      const main = document.createElement('div');
      main.className = 'file-main';
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = item.path.split('/').pop();
      const meta = document.createElement('div');
      meta.className = 'file-meta';
      meta.textContent = item.path.split('/').slice(0, -1).join('/') + ' · ' + formatBytes(item.size);
      main.appendChild(fileName);
      main.appendChild(meta);
      const button = document.createElement('button');
      button.textContent = t('result.save');
      button.onclick = () => saveOutput(item);
      row.appendChild(main);
      row.appendChild(button);
      files.appendChild(row);
    }
    $('saveAllBtn').disabled = outputs.length === 0;
    $('saveGlbBtn').disabled = outputs.length === 0;
    $('saveObjBtn').disabled = outputs.length === 0;
    state.preview = { groups, terrain, buildings, roads, water, texture: state.hybridCanvas };
    state.previewState.ready = false;
    $('previewWrap').hidden = true;
  }

  function saveOutput(item) {
    if (window.Android && typeof Android.saveFile === 'function') {
      const bytes = typeof item.data === 'string' ? textBytes(item.data) : item.data;
      Android.saveFile(item.path, item.mime, bytesToB64(bytes));
    } else {
      const bytes = typeof item.data === 'string' ? textBytes(item.data) : item.data;
      const blob = new Blob([bytes], { type: item.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.path.split('/').pop();
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }

  function saveAll() {
    if (!state.outputs.length) return;
    state.outputs.forEach((item, index) => {
      setTimeout(() => saveOutput(item), index * 220);
    });
  }

  function saveMatching(extensions, includeTextures) {
    if (!state.outputs.length) return;
    let items = state.outputs.filter((item) => extensions.some((ext) => item.path.endsWith(ext)));
    if (includeTextures) {
      const textures = state.outputs.filter((item) => item.path.includes('/textures/') || item.path.endsWith('/hybrid.jpg'));
      items = items.concat(textures.filter((item) => !items.includes(item)));
    }
    items.forEach((item, index) => {
      setTimeout(() => saveOutput(item), index * 220);
    });
  }

  function showPreview() {
    const preview = state.preview;
    if (!preview) return;
    $('previewWrap').hidden = false;
    if (!state.previewState.ready) {
      state.previewState.ready = true;
      const bounds = preview.terrain;
      const textCanvas = preview.texture;
      const texture = textCanvas.getContext('2d').getImageData(0, 0, textCanvas.width, textCanvas.height).data;
      const target = [0, 0, 0];
      let minZ = Infinity, maxZ = -Infinity;
      for (const value of preview.terrain.z) {
        if (value < minZ) minZ = value;
        if (value > maxZ) maxZ = value;
      }
      target[2] = (maxZ - minZ) / 2;
      const span = Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin, maxZ - minZ);
      state.previewState.distance = span * 1.8;
      state.previewState.target = target;
      state.previewState.texture = texture;
      state.previewState.textureWidth = textCanvas.width;
      state.previewState.textureHeight = textCanvas.height;
      initPreviewControls();
      requestAnimationFrame(renderPreview);
    }
  }

  function initPreviewControls() {
    const canvas = $('previewCanvas');
    canvas.width = 720;
    canvas.height = 420;
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      state.previewState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.previewState.pointers.size === 2) {
        const values = Array.from(state.previewState.pointers.values());
        state.previewState.pinch = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      const pointers = state.previewState.pointers;
      if (!pointers.has(event.pointerId)) return;
      const previous = pointers.get(event.pointerId);
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const values = Array.from(pointers.values());
        const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
        if (state.previewState.pinch) {
          state.previewState.distance *= state.previewState.pinch / Math.max(1, distance);
          state.previewState.pinch = distance;
        }
      } else {
        state.previewState.yaw -= dx * 0.008;
        state.previewState.pitch = D.clamp(state.previewState.pitch + dy * 0.006, 0.18, 1.35);
      }
      requestAnimationFrame(renderPreview);
    });
    const release = (event) => {
      state.previewState.pointers.delete(event.pointerId);
      if (state.previewState.pointers.size < 2) state.previewState.pinch = 0;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      state.previewState.distance *= event.deltaY > 0 ? 1.12 : 0.89;
      requestAnimationFrame(renderPreview);
    }, { passive: false });
  }

  function renderPreview() {
    const preview = state.preview;
    const previewState = state.previewState;
    if (!preview || !previewState.target) return;
    const canvas = $('previewCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width, height = canvas.height;
    ctx.fillStyle = '#0b110e';
    ctx.fillRect(0, 0, width, height);
    const target = previewState.target;
    const distance = previewState.distance;
    const cy = Math.cos(previewState.pitch), sy = Math.sin(previewState.pitch);
    const camera = [
      target[0] + Math.cos(previewState.yaw) * cy * distance,
      target[1] + Math.sin(previewState.yaw) * cy * distance,
      target[2] + sy * distance,
    ];
    const normalize = (v) => {
      const len = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / len, v[1] / len, v[2] / len];
    };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const forward = normalize([target[0] - camera[0], target[1] - camera[1], target[2] - camera[2]]);
    const right = normalize(cross(forward, [0, 0, 1]));
    const up = normalize(cross(right, forward));
    const focal = height * 1.3;
    const project = (p) => {
      const v = [p[0] - camera[0], p[1] - camera[1], p[2] - camera[2]];
      const depth = v[0] * forward[0] + v[1] * forward[1] + v[2] * forward[2];
      if (depth < 0.2) return null;
      return {
        x: width / 2 + (v[0] * right[0] + v[1] * right[1] + v[2] * right[2]) * focal / depth,
        y: height / 2 - (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]) * focal / depth,
        depth,
      };
    };
    const items = [];
    const texture = previewState.texture;
    const tw = previewState.textureWidth, th = previewState.textureHeight;
    for (const group of preview.groups) {
      const positions = group.positions;
      const indices = group.indices;
      const count = Math.floor(indices.length / 3);
      const step = Math.max(1, Math.ceil(count / 42000));
      for (let t = 0; t < count; t += step) {
        const ia = indices[t * 3] * 3, ib = indices[t * 3 + 1] * 3, ic = indices[t * 3 + 2] * 3;
        const pa = [positions[ia], positions[ia + 1], positions[ia + 2]];
        const pb = [positions[ib], positions[ib + 1], positions[ib + 2]];
        const pc = [positions[ic], positions[ic + 1], positions[ic + 2]];
        const sa = project(pa), sb = project(pb), sc = project(pc);
        if (!sa || !sb || !sc) continue;
        let color = group.color || [0.6, 0.6, 0.6, 1];
        if (group.textured && group.uvs && texture) {
          const ua = group.uvs[indices[t * 3] * 2], va = group.uvs[indices[t * 3] * 2 + 1];
          const ub = group.uvs[indices[t * 3 + 1] * 2], vb = group.uvs[indices[t * 3 + 1] * 2 + 1];
          const uc = group.uvs[indices[t * 3 + 2] * 2], vc = group.uvs[indices[t * 3 + 2] * 2 + 1];
          const u = Math.round((ua + ub + uc) / 3 * (tw - 1));
          const v = Math.round((1 - (va + vb + vc) / 3) * (th - 1));
          const index = (D.clamp(v, 0, th - 1) * tw + D.clamp(u, 0, tw - 1)) * 4;
          color = [texture[index] / 255, texture[index + 1] / 255, texture[index + 2] / 255, 1];
        }
        const shade = 0.62 + 0.3 * Math.max(0, (pa[2] + pb[2] + pc[2]) / 3 / Math.max(1, preview.terrain.baseElevation + 1));
        const rgb = color.slice(0, 3).map((value) => Math.round(D.clamp(value * shade, 0, 1) * 255));
        items.push({ depth: (sa.depth + sb.depth + sc.depth) / 3, points: [sa, sb, sc], color: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` });
      }
    }
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      ctx.lineTo(item.points[1].x, item.points[1].y);
      ctx.lineTo(item.points[2].x, item.points[2].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#9fb1a7';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(t('result.trianglesLabel', { count: (preview.groups.reduce((sum, g) => sum + g.indices.length / 3, 0)).toFixed(0) }), 14, height - 14);
  }

  const QUALITY_PRESETS = {
    fast: { spacing: '60', texture: '1024', smoothing: '1' },
    balanced: { spacing: '30', texture: '2048', smoothing: '0' },
    detail: { spacing: '15', texture: '2048', smoothing: '0' },
  };

  function applyQuality(name) {
    const preset = QUALITY_PRESETS[name];
    if (!preset) return;
    $('spacing').value = preset.spacing;
    $('texture').value = preset.texture;
    $('smoothing').value = preset.smoothing;
    updateQualityState();
  }

  function updateQualityState() {
    const current = {
      spacing: $('spacing').value,
      texture: $('texture').value,
      smoothing: $('smoothing').value,
    };
    document.querySelectorAll('.quality').forEach((button) => {
      const preset = QUALITY_PRESETS[button.dataset.quality];
      button.classList.toggle('active', !!preset && Object.keys(current).every((key) => current[key] === preset[key]));
    });
  }

  function renderResultSummary() {
    const data = state.resultSummary;
    if (!data) return;
    $('resultPill').textContent = t('result.count', { buildings: data.buildings, roads: data.roads });
    const summary = $('resultSummary');
    summary.hidden = false;
    summary.textContent = '';
    const items = [
      [t('result.area'), `${Number(data.area || 0).toFixed(2)} ${t('km')}²`],
      [t('result.triangles'), data.triangles.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')],
      [t('result.buildings'), String(data.buildings)],
      [t('result.roads'), String(data.roads)],
      [t('result.water'), String(data.water || 0)],
    ];
    for (const [label, value] of items) {
      const item = document.createElement('div');
      item.className = 'stat';
      const name = document.createElement('span');
      name.textContent = label;
      const number = document.createElement('b');
      number.textContent = value;
      item.appendChild(name);
      item.appendChild(number);
      summary.appendChild(item);
    }
    const warnings = $('resultWarnings');
    warnings.textContent = '';
    if (state.warnings.length) {
      warnings.hidden = false;
      const title = document.createElement('b');
      title.textContent = t('warning.title');
      warnings.appendChild(title);
      const list = document.createElement('ul');
      for (const warning of state.warnings) {
        const item = document.createElement('li');
        item.textContent = warning;
        list.appendChild(item);
      }
      warnings.appendChild(list);
    } else {
      warnings.hidden = true;
    }
  }

  function init() {
    $('tiles').textContent = '';
    $('langSelect').value = lang;
    $('langSelect').onchange = (event) => {
      setLanguage(event.target.value);
      if (state.resultSummary) renderResultSummary();
    };
    document.querySelectorAll('.quality').forEach((button) => {
      button.onclick = () => applyQuality(button.dataset.quality);
    });
    for (const id of ['spacing', 'texture', 'smoothing']) {
      $(id).addEventListener('change', updateQualityState);
    }
    applyLanguage();
    updateQualityState();
    $('helpBtn').onclick = () => { $('help').hidden = false; };
    $('helpClose').onclick = () => { $('help').hidden = true; };
    $('help').onclick = (event) => { if (event.target === $('help')) $('help').hidden = true; };
    $('findBtn').onclick = findPlace;
    $('search').addEventListener('keydown', (event) => { if (event.key === 'Enter') findPlace(); });
    $('locateBtn').onclick = locate;
    $('clearBtn').onclick = clearZone;
    $('zoneApplyBtn').onclick = applyZone;
    $('zoneCenterBtn').onclick = zoneToMapCenter;
    for (const [id, size] of [['preset05Btn', 0.5], ['preset1Btn', 1], ['preset2Btn', 2], ['preset3Btn', 3]]) {
      $(id).onclick = () => applyZonePreset(size);
    }
    for (const id of ['zoneWidth', 'zoneHeight', 'zoneLat', 'zoneLon']) {
      $(id).addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyZone();
        }
      });
    }
    $('generateBtn').onclick = generate;
    $('saveAllBtn').onclick = saveAll;
    $('saveGlbBtn').onclick = () => saveMatching(['.glb']);
    $('saveObjBtn').onclick = () => saveMatching(['.obj', '.mtl'], true);
    $('previewBtn').onclick = showPreview;
    $('selectBtn').onclick = () => {
      state.map.mode = state.map.mode === 'select' ? 'pan' : 'select';
      $('map').classList.toggle('selecting', state.map.mode === 'select');
      $('selectBtn').classList.toggle('active', state.map.mode === 'select');
      $('mapHint').textContent = state.map.mode === 'select'
        ? t('map.hint.select')
        : t('map.hint.pan');
    };
    $('zoomInBtn').onclick = () => zoomBy(1);
    $('zoomOutBtn').onclick = () => zoomBy(-1);
    if (window.PointerEvent) {
      $('map').addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    } else {
      const touch = (source, id) => ({
        pointerId: id || 0,
        clientX: source.clientX,
        clientY: source.clientY,
        target: $('map'),
      });
      $('map').addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1) return;
        if (event.target.closest('button')) return;
        event.preventDefault();
        onPointerDown(touch(event.touches[0], 'touch'));
      }, { passive: false });
      window.addEventListener('touchmove', (event) => {
        if (event.touches.length !== 1) return;
        if (!state.map.drag || state.map.drag.id !== 'touch') return;
        event.preventDefault();
        onPointerMove(touch(event.touches[0], 'touch'));
      }, { passive: false });
      const endTouch = (event) => {
        if (!event.changedTouches.length) return;
        onPointerUp(touch(event.changedTouches[0], 'touch'));
      };
      window.addEventListener('touchend', endTouch);
      window.addEventListener('touchcancel', endTouch);
    }
    $('map').addEventListener('wheel', onMapWheel, { passive: false });
    window.addEventListener('resize', resizeMap);
    if (window.ResizeObserver) new ResizeObserver(resizeMap).observe($('map'));
    resizeMap();
    syncZoneInputs(null);
    setTimeout(resizeMap, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// State
let currentSong = null;
let currentLyrics = [];
let lyricsTimer = null;
let displayMode = "normal"; // "normal" | "compact" | "lyrics-only"
let marqueeTimeout = null;
let lyricsStartTime = null;

// DOM refs
const $ = (id) => document.getElementById(id);
const statusTime = $("statusTime");
const clockTime = $("clockTime");
const clockDate = $("clockDate");
const lockClock = $("lockClock");
const emptyState = $("emptyState");
const nowPlaying = $("nowPlaying");
const albumArt = $("albumArt");
const songTitle = $("songTitle");
const songArtist = $("songArtist");
const lyricsArea = $("lyricsArea");
const lyricsScroll = $("lyricsScroll");
const loading = $("loading");
const searchInput = $("searchInput");
const searchResults = $("searchResults");
const resultsList = $("resultsList");
const closeResults = $("closeResults");
// Status bar lyrics
const statusLabel = $("statusLabel");
const statusLyrics = $("statusLyrics");
const statusLyricCN = $("statusLyricCN");
const statusLyricTrans = $("statusLyricTrans");
const modeToggle = $("modeToggle");
const lyricBar = $("lyricBar");
const lyricBarCN = $("lyricBarCN");
const lyricBarTrans = $("lyricBarTrans");
const lyricBarProgress = $("lyricBarProgress");
const phoneFrame = document.querySelector(".phone-frame");

// ========== Time ==========
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const timeStr = h + ":" + m;
  statusTime.textContent = timeStr;
  clockTime.textContent = timeStr;

  const days = ["日", "一", "二", "三", "四", "五", "六"];
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const d = now.getDate();
  const day = days[now.getDay()];
  clockDate.textContent = y + "年" + mo + "月" + d + "日 星期" + day;
}

updateClock();
setInterval(updateClock, 10000);

// ========== API calls ==========
async function searchSongs(keyword) {
  const res = await fetch("/api/search?keyword=" + encodeURIComponent(keyword));
  const data = await res.json();
  return data.songs || [];
}

async function fetchLyrics(songMid) {
  const res = await fetch("/api/lyrics/" + songMid);
  const data = await res.json();
  return data;
}

function getAlbumArtUrl(albumMid) {
  if (!albumMid) return "";
  return "https://y.gtimg.cn/music/photo_new/T002R300x300M000" + albumMid + ".jpg";
}

// ========== LRC parser ==========
function parseLRC(lrcText) {
  if (!lrcText || !lrcText.trim()) return [];
  const lines = lrcText.split("\n");
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})[\.:]\d{2,3}\]/g;

  lines.forEach(function(line) {
    const text = line.replace(timeRegex, "").trim();
    if (!text) return;

    let match;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const time = minutes * 60 + seconds;
      result.push({ time: time, text: text });
    }
  });

  result.sort(function(a, b) { return a.time - b.time; });
  return result;
}

function mergeLyrics(cnLyrics, transLyrics) {
  const cn = parseLRC(cnLyrics);
  const trans = parseLRC(transLyrics);

  // Build a map of translation by time
  const transMap = {};
  trans.forEach(function(t) {
    transMap[t.time] = t.text;
  });

  // Merge
  const merged = cn.map(function(item) {
    return {
      time: item.time,
      text: item.text,
      trans: transMap[item.time] || ""
    };
  });

  return merged;
}

// ========== Status bar lyrics ==========
function updateStatusBarLyrics(lyricLine, isPlaying) {
  if (!lyricLine) {
    statusLabel.classList.remove("hidden");
    statusLyrics.classList.add("hidden");
    lyricBar.classList.add("hidden");
    return;
  }

  // Always show in status bar
  statusLabel.classList.add("hidden");
  statusLyrics.classList.remove("hidden");

  const cnText = lyricLine.text || "";
  const transText = lyricLine.trans || "";

  statusLyricCN.textContent = cnText;
  statusLyricTrans.textContent = transText || "";

  if (!transText) {
    statusLyricTrans.style.display = "none";
  } else {
    statusLyricTrans.style.display = "";
  }

  // Marquee for long text
  applyMarquee(statusLyricCN, cnText);
  applyMarquee(statusLyricTrans, transText);

  // Update lyric bar (compact mode)
  lyricBarCN.textContent = cnText;
  lyricBarTrans.textContent = transText || "";

  if (!transText) {
    lyricBarTrans.style.display = "none";
  } else {
    lyricBarTrans.style.display = "";
  }
}

function applyMarquee(el, text) {
  // Clear previous
  el.classList.remove("marquee");
  el.style.animation = "none";

  if (!text) return;

  // Check if text overflows
  const parentWidth = el.parentElement ? el.parentElement.clientWidth : 180;
  // Rough estimate: each Chinese char ~13px, each English char ~7px at 13px font
  const cnChars = (text.match(/[一-鿿]/g) || []).length;
  const enChars = text.length - cnChars;
  const estimatedWidth = cnChars * 13 + enChars * 7;

  if (estimatedWidth > parentWidth) {
    el.classList.add("marquee");
  }
}

// ========== Progress bar update ==========
function updateLyricBarProgress(elapsedSec, totalDurationSec) {
  if (totalDurationSec > 0) {
    const pct = Math.min((elapsedSec / totalDurationSec) * 100, 100);
    lyricBarProgress.style.width = pct + "%";
  }
}

// ========== Render lyrics ==========
function renderLyrics(lyrics) {
  lyricsScroll.innerHTML = "";
  currentLyrics = lyrics;

  if (!lyrics || lyrics.length === 0) {
    lyricsScroll.innerHTML = "<div style=\"text-align:center;color:var(--text-tertiary);padding:40px 0;font-size:14px;\">暂无歌词</div>";
    return;
  }

  lyrics.forEach(function(line, i) {
    const div = document.createElement("div");
    div.className = "lyric-line " + (i % 2 === 0 ? "even" : "odd");
    div.dataset.index = i;

    const cn = document.createElement("div");
    cn.className = "lyric-cn";
    cn.textContent = line.text;

    const tr = document.createElement("div");
    tr.className = "lyric-trans";
    tr.textContent = line.trans || "";

    div.appendChild(cn);
    if (line.trans) {
      div.appendChild(tr);
    }

    lyricsScroll.appendChild(div);
  });

  // Start auto-scroll simulation
  startLyricsAutoScroll(lyrics);
}

// ========== Auto-scroll simulation ==========
function startLyricsAutoScroll(lyrics) {
  if (lyricsTimer) {
    clearInterval(lyricsTimer);
    lyricsTimer = null;
  }

  let currentIndex = 0;
  lyricsStartTime = Date.now() / 1000;

  function updateHighlight() {
    const elapsed = (Date.now() / 1000) - lyricsStartTime;

    // Find the current line based on elapsed time
    let activeIndex = 0;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (elapsed >= lyrics[i].time) {
        activeIndex = i;
        break;
      }
    }

    // If no lyrics have time info, use estimated scrolling
    const allSameTime = lyrics.length > 0 && lyrics.every(function(l) {
      return l.time === lyrics[0].time;
    });
    if (allSameTime) {
      const duration = 30; // estimated song duration
      const lineDuration = duration / lyrics.length;
      activeIndex = Math.min(Math.floor(elapsed / lineDuration), lyrics.length - 1);
    }

    if (activeIndex !== currentIndex) {
      currentIndex = activeIndex;
      const items = lyricsScroll.querySelectorAll(".lyric-line");
      items.forEach(function(item, i) {
        item.classList.toggle("active", i === currentIndex);
      });

      // Scroll to active
      if (items[currentIndex]) {
        items[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Update status bar lyrics
      if (displayMode !== "normal") {
        updateStatusBarLyrics(lyrics[currentIndex], true);
        if (displayMode === "compact") {
          updateLyricBarProgress(elapsed, getEstSongDuration(lyrics));
        }
      }
    }
  }

  // Initial highlight
  updateHighlight();
  // Also show first lyric in status bar if in compact mode
  if (lyrics.length > 0 && displayMode !== "normal") {
    updateStatusBarLyrics(lyrics[0], true);
    if (displayMode === "compact") {
      lyricBar.classList.remove("hidden");
    }
  }

  lyricsTimer = setInterval(updateHighlight, 500);
}

function getEstSongDuration(lyrics) {
  if (!lyrics || lyrics.length === 0) return 240; // default 4min
  const lastLine = lyrics[lyrics.length - 1];
  if (lastLine.time > 0) {
    return lastLine.time + 5; // add 5s buffer
  }
  return 240;
}

// ========== Show song ==========
async function showSong(song) {
  currentSong = song;

  // Update UI
  emptyState.classList.add("hidden");
  nowPlaying.classList.remove("hidden");
  lyricsArea.classList.remove("hidden");
  lockClock.classList.add("has-song");

  songTitle.textContent = song.name;
  songArtist.textContent = song.singer;

  // Album art
  albumArt.classList.remove("playing");
  albumArt.innerHTML = "";
  if (song.albumMid) {
    const img = document.createElement("img");
    img.src = getAlbumArtUrl(song.albumMid);
    img.alt = song.album;
    img.onerror = function() {
      albumArt.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"64\" height=\"64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/></svg>";
    };
    albumArt.appendChild(img);
  } else {
    albumArt.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"64\" height=\"64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/></svg>";
  }
  // Start spinning after a short delay
  setTimeout(function() { albumArt.classList.add("playing"); }, 300);

  // Fetch lyrics
  loading.classList.remove("hidden");
  lyricsScroll.innerHTML = "";

  try {
    const data = await fetchLyrics(song.mid);

    if (data.lyric || data.trans) {
      const merged = mergeLyrics(data.lyric || "", data.trans || "");
      renderLyrics(merged);
    } else {
      lyricsScroll.innerHTML = "<div style=\"text-align:center;color:var(--text-tertiary);padding:40px 0;font-size:14px;\">暂无歌词</div>";
    }
  } catch (err) {
    console.error("Failed to load lyrics:", err);
    lyricsScroll.innerHTML = "<div style=\"text-align:center;color:var(--text-tertiary);padding:40px 0;font-size:14px;\">加载失败，请重试</div>";
  }

  loading.classList.add("hidden");
}

// ========== Search ==========
let searchTimeout = null;

searchInput.addEventListener("input", function() {
  const keyword = searchInput.value.trim();
  if (searchTimeout) clearTimeout(searchTimeout);

  if (keyword.length < 2) {
    searchResults.classList.add("hidden");
    return;
  }

  searchTimeout = setTimeout(async function() {
    try {
      const songs = await searchSongs(keyword);
      renderResults(songs);
      searchResults.classList.remove("hidden");
    } catch (err) {
      console.error("Search failed:", err);
    }
  }, 400);
});

searchInput.addEventListener("focus", function() {
  if (searchInput.value.trim().length >= 2) {
    searchResults.classList.remove("hidden");
  }
});

closeResults.addEventListener("click", function() {
  searchResults.classList.add("hidden");
  searchInput.blur();
});

function renderResults(songs) {
  resultsList.innerHTML = "";

  if (songs.length === 0) {
    resultsList.innerHTML = "<div style=\"text-align:center;color:var(--text-tertiary);padding:40px 0;font-size:14px;\">未找到相关歌曲</div>";
    return;
  }

  songs.forEach(function(song) {
    const item = document.createElement("div");
    item.className = "result-item";

    const art = document.createElement("div");
    art.className = "result-art";

    const img = document.createElement("img");
    img.src = getAlbumArtUrl(song.albumMid);
    img.alt = song.album;
    img.onerror = function() {
      art.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/></svg>";
    };
    art.appendChild(img);

    const info = document.createElement("div");
    info.className = "result-info";

    const name = document.createElement("div");
    name.className = "result-name";
    name.textContent = song.name;

    const singer = document.createElement("div");
    singer.className = "result-singer";
    singer.textContent = song.singer;

    info.appendChild(name);
    info.appendChild(singer);

    item.appendChild(art);
    item.appendChild(info);

    item.addEventListener("click", function() {
      searchResults.classList.add("hidden");
      searchInput.value = song.name;
      searchInput.blur();
      showSong(song);
    });

    resultsList.appendChild(item);
  });
}

// ========== Display mode toggle ==========
function setDisplayMode(mode) {
  displayMode = mode;
  phoneFrame.classList.remove("compact", "lyrics-only");

  switch (mode) {
    case "normal":
      modeToggle.classList.remove("active");
      lyricBar.classList.add("hidden");
      statusLabel.classList.remove("hidden");
      statusLyrics.classList.add("hidden");
      // Restore normal view
      lyricsArea.classList.remove("hidden");
      nowPlaying.classList.remove("hidden");
      lockClock.classList.remove("has-song");
      if (currentSong) {
        lockClock.classList.add("has-song");
      }
      break;

    case "compact":
      // Status bar + lyric bar only, content area hidden
      modeToggle.classList.add("active");
      phoneFrame.classList.add("compact");
      lyricBar.classList.remove("hidden");
      if (currentLyrics.length > 0) {
        // Find current lyric line
        var elapsed = lyricsStartTime ? (Date.now() / 1000) - lyricsStartTime : 0;
        var idx = 0;
        for (var i = currentLyrics.length - 1; i >= 0; i--) {
          if (elapsed >= currentLyrics[i].time) {
            idx = i;
            break;
          }
        }
        updateStatusBarLyrics(currentLyrics[idx], true);
        updateLyricBarProgress(elapsed, getEstSongDuration(currentLyrics));
      }
      break;

    case "lyrics-only":
      // Show status bar lyrics + full lyrics area, hide album art
      modeToggle.classList.add("active");
      phoneFrame.classList.add("lyrics-only");
      lyricBar.classList.add("hidden");
      if (currentLyrics.length > 0) {
        var elapsed2 = lyricsStartTime ? (Date.now() / 1000) - lyricsStartTime : 0;
        var idx2 = 0;
        for (var j = currentLyrics.length - 1; j >= 0; j--) {
          if (elapsed2 >= currentLyrics[j].time) {
            idx2 = j;
            break;
          }
        }
        updateStatusBarLyrics(currentLyrics[idx2], true);
      }
      break;
  }
}

modeToggle.addEventListener("click", function() {
  var modes = ["normal", "compact", "lyrics-only"];
  var currentIdx = modes.indexOf(displayMode);
  var nextIdx = (currentIdx + 1) % modes.length;
  setDisplayMode(modes[nextIdx]);
});

// ========== Keyboard shortcut ==========
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    searchResults.classList.add("hidden");
    searchInput.blur();
  }
  if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === "m" && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInput) {
    var modes = ["normal", "compact", "lyrics-only"];
    var currentIdx = modes.indexOf(displayMode);
    var nextIdx = (currentIdx + 1) % modes.length;
    setDisplayMode(modes[nextIdx]);
  }
});

// Click outside to close results
document.addEventListener("click", function(e) {
  if (!searchResults.contains(e.target) && e.target !== searchInput && !searchInput.contains(e.target)) {
    searchResults.classList.add("hidden");
  }
});

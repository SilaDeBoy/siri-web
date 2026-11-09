(() => {
  "use strict";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  const els = {
    orbWrap: document.getElementById("orbWrap"),
    orb: document.getElementById("orb"),
    micBtn: document.getElementById("micBtn"),
    greeting: document.getElementById("greeting"),
    transcript: document.getElementById("transcript"),
    response: document.getElementById("response"),
    hint: document.getElementById("hint"),
    statusTime: document.getElementById("statusTime"),
    suggestions: document.getElementById("suggestions"),
  };

  let recognition = null;
  let listening = false;
  let speaking = false;

  // ---------- Clock ----------
  function updateTime() {
    const now = new Date();
    els.statusTime.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  updateTime();
  setInterval(updateTime, 30_000);

  // ---------- UI state ----------
  function setListening(on) {
    listening = on;
    els.orbWrap.classList.toggle("listening", on);
    els.micBtn.classList.toggle("active", on);
    els.greeting.classList.toggle("dim", on || speaking);
    els.hint.textContent = on ? "Listening…" : "Tap the mic or say “Hey Siri”";
    if (!on && !speaking) els.transcript.textContent = "";
  }

  function setSpeaking(on) {
    speaking = on;
    els.orbWrap.classList.toggle("speaking", on);
    els.greeting.classList.toggle("dim", on || listening);
  }

  function showResponse(text) {
    els.response.textContent = text;
    els.response.classList.add("show");
  }

  function clearResponse() {
    els.response.classList.remove("show");
    els.response.textContent = "";
  }

  // ---------- Speech synthesis (Siri-like replies) ----------
  function speak(text) {
    return new Promise((resolve) => {
      if (!synth) {
        showResponse(text);
        resolve();
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1.05;
      u.volume = 1;

      // Prefer a soft English voice when available
      const voices = synth.getVoices();
      const preferred =
        voices.find((v) => /samantha|karen|moira|google us english|samsung english/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith("en") && v.localService) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) u.voice = preferred;

      setSpeaking(true);
      showResponse(text);
      u.onend = () => {
        setSpeaking(false);
        resolve();
      };
      u.onerror = () => {
        setSpeaking(false);
        resolve();
      };
      synth.speak(u);
    });
  }

  // ---------- Open helpers (legitimate – user-initiated new tabs) ----------
  function openUrl(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openYouTubeSearch(query) {
    const q = encodeURIComponent(query || "");
    openUrl(q ? `https://www.youtube.com/results?search_query=${q}` : "https://www.youtube.com");
  }

  function openApp(name) {
    const map = {
      youtube: "https://www.youtube.com",
      instagram: "https://www.instagram.com",
      whatsapp: "https://web.whatsapp.com",
      twitter: "https://twitter.com",
      x: "https://x.com",
      facebook: "https://www.facebook.com",
      tiktok: "https://www.tiktok.com",
      maps: "https://maps.google.com",
      gmail: "https://mail.google.com",
      google: "https://www.google.com",
      netflix: "https://www.netflix.com",
      spotify: "https://open.spotify.com",
    };
    const key = name.toLowerCase().replace(/\s+/g, "");
    if (map[key]) {
      openUrl(map[key]);
      return true;
    }
    return false;
  }

  // ---------- Command parser ----------
  async function handleCommand(raw) {
    const text = (raw || "").trim().replace(/^hey siri[,.]?\s*/i, "");
    if (!text) {
      await speak("Yes?");
      return;
    }

    els.transcript.textContent = text;
    const lower = text.toLowerCase();

    // Open YouTube / search
    if (/^(open|go to|launch)\s+youtube\b/i.test(lower) || lower === "youtube") {
      await speak("Opening YouTube.");
      openApp("youtube");
      return;
    }
    if (/search\s+(on\s+)?youtube\s+(for\s+)?(.+)/i.test(lower)) {
      const m = lower.match(/search\s+(?:on\s+)?youtube\s+(?:for\s+)?(.+)/i);
      const q = (m && m[1]) || "";
      await speak(q ? `Searching YouTube for ${q}.` : "Opening YouTube search.");
      openYouTubeSearch(q);
      return;
    }
    if (/^(play|find|look up)\s+(.+)\s+on\s+youtube/i.test(lower)) {
      const m = lower.match(/^(?:play|find|look up)\s+(.+)\s+on\s+youtube/i);
      const q = (m && m[1]) || "";
      await speak(`Searching YouTube for ${q}.`);
      openYouTubeSearch(q);
      return;
    }

    // Generic open app
    const openMatch = lower.match(/^(open|go to|launch)\s+(.+)/i);
    if (openMatch) {
      const app = openMatch[2].replace(/\s+app$/, "").trim();
      if (openApp(app)) {
        await speak(`Opening ${app}.`);
        return;
      }
      // Fallback: Google search for the name
      await speak(`I couldn't open ${app} directly. Searching the web.`);
      openUrl(`https://www.google.com/search?q=${encodeURIComponent(app)}`);
      return;
    }

    // Time
    if (/what time|current time|time is it/i.test(lower)) {
      const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      await speak(`It's ${t}.`);
      return;
    }

    // Date
    if (/what('s| is) (the )?date|what day/i.test(lower)) {
      const d = new Date().toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      await speak(`Today is ${d}.`);
      return;
    }

    // Hello
    if (/^(hi|hello|hey)\b/i.test(lower)) {
      await speak("Hi. How can I help you?");
      return;
    }

    // Help
    if (/help|what can you do|commands/i.test(lower)) {
      await speak(
        "You can say things like Open YouTube, Search YouTube for music, Open Instagram, or ask for the time."
      );
      return;
    }

    // Web search fallback
    if (/^(search|google|look up)\s+(.+)/i.test(lower)) {
      const m = lower.match(/^(?:search|google|look up)\s+(.+)/i);
      const q = (m && m[1]) || text;
      await speak(`Searching for ${q}.`);
      openUrl(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
      return;
    }

    // Default: treat as search
    await speak(`Here's what I found for ${text}.`);
    openUrl(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
  }

  // ---------- Speech recognition ----------
  function startListening() {
    if (!SpeechRecognition) {
      speak("Speech recognition isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) return;

    clearResponse();
    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setListening(true);

      recognition.onresult = (event) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        els.transcript.textContent = finalText || interim;
        if (finalText) {
          setListening(false);
          handleCommand(finalText);
        }
      };

      recognition.onerror = (e) => {
        setListening(false);
        if (e.error === "not-allowed") {
          speak("Microphone access is blocked. Please allow the mic and try again.");
        } else if (e.error !== "aborted" && e.error !== "no-speech") {
          els.hint.textContent = "Couldn't hear you. Tap the mic to try again.";
        }
      };

      recognition.onend = () => {
        if (listening) setListening(false);
      };
    }

    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    if (recognition && listening) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    setListening(false);
  }

  function toggleMic() {
    if (listening) stopListening();
    else startListening();
  }

  // ---------- Events ----------
  els.micBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMic();
  });

  els.orb.addEventListener("click", () => toggleMic());

  els.suggestions.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    const cmd = btn.getAttribute("data-cmd");
    els.transcript.textContent = cmd;
    handleCommand(cmd);
  });

  // Warm up voices on some browsers
  if (synth) {
    synth.getVoices();
    speechSynthesis.onvoiceschanged = () => synth.getVoices();
  }

  // First-run message
  setTimeout(() => {
    if (!els.response.textContent) {
      showResponse("Tap the mic and try “Open YouTube”");
      setTimeout(() => {
        if (els.response.textContent.includes("Open YouTube")) clearResponse();
      }, 4000);
    }
  }, 800);
})();

function app() {
  // Get chart selection synchronously during initialization
  const getSavedChart = () => {
    try {
      const key = localStorage.getItem('next_track_selected_chart');
      const allowedKeys = ['porcys100', 'rs500', 'bigbeat25'];
      return allowedKeys.includes(key) ? key : 'porcys100';
    } catch {
      return 'porcys100';
    }
  };
  
  return {
    all: [],
    current: null,
    coverUrl: 'https://placehold.co/512x512/png?text=Loading',
    loading: true,
    caption: 'Cover via public APIs',
    spotifyUrl: null,
    ytMusicUrl: null,
    finder: null,
    history: [],
    copiedKey: null,
    STORAGE_KEY: 'next_track_history',
    charts: {
      porcys100: { key: 'porcys100', label: 'Porcys Top 100', path: 'charts/porcys100.json' },
      rs500: { key: 'rs500', label: 'Rolling Stone 500', path: 'charts/rs500.json' },
      bigbeat25: { key: 'bigbeat25', label: 'Z Archiwum Polskiego Beatu', path: 'charts/bigbeat25.json' }
    },
    SELECTED_CHART_KEY: 'next_track_selected_chart',
    chartKey: getSavedChart(),

    async init() {
      await this.loadChartData();
      this.finder = new window.CoverFinder();
      this.loadHistory();
      await this.refresh();
    },

    async loadChartData() {
      try {
        const meta = this.charts[this.chartKey];
        const res = await fetch(meta.path);
        this.all = await res.json();
      } catch (e) {
        console.error('Failed to load chart', this.chartKey, e);
        this.all = [];
      }
    },

    async onChartChange() {
      localStorage.setItem(this.SELECTED_CHART_KEY, this.chartKey);
      await this.loadChartData();
      await this.refresh();
    },

    pickRandom() {
      if (!this.all?.length) return;
      const i = Math.floor(Math.random() * this.all.length);
      this.current = this.all[i];
    },

    async refresh() {
      this.loading = true;
      this.coverUrl = 'https://placehold.co/512x512?text=Loading';
      this.pickRandom();
      if (!this.current) { this.loading = false; return; }

      // Default links
      this.spotifyUrl = this.finder.getSpotifySearchUrl(this.current.artist, this.current.album);
      this.ytMusicUrl = this.finder.getYouTubeMusicUrl(this.current.artist, this.current.album);

      const res = await this.finder.getCoverAndLinks(this.current.artist, this.current.album);
      this.coverUrl = res.coverUrl;
      this.caption = res.caption;
      this.spotifyUrl = res.spotifyUrl || this.spotifyUrl;

      // add/update history (with chart info)
      this.addToHistory({
        date: new Date().toISOString(),
        artist: this.current.artist,
        album: this.current.album,
        spotifyUrl: this.spotifyUrl,
        chartKey: this.chartKey,
        chartLabel: this.charts[this.chartKey]?.label
      });

      this.loading = false;
    },

    onImgError() {
      // If image fails, try iTunes once, else fallback to placeholder
      if (!this.current || !this.finder) return;
      this.finder.lookupItunes(this.current.artist, this.current.album).then(url => {
        this.coverUrl = url || `https://placehold.co/512x512?text=${encodeURIComponent(this.current.artist + '\n' + this.current.album)}`;
      });
    },

    loadHistory() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        this.history = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
      } catch {
        this.history = [];
      }
    },
    
    saveHistory() {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
      } catch {}
    },
    
    addToHistory(entry) {
      const key = `${entry.artist} | ${entry.album} | ${entry.chartKey}`;
      // de-duplicate by artist+album+chart, keep newest on top
      this.history = this.history.filter(h => h.key !== key);
      this.history.unshift({ key, ...entry });
      // optional cap to last 50
      if (this.history.length > 50) this.history.length = 50;
      this.saveHistory();
    },
    
    async copyEntry(item) {
      const text = `${item.artist} - ${item.album}`;
      try {
        await navigator.clipboard.writeText(text);
        this.copiedKey = item.key;
        setTimeout(() => { this.copiedKey = null; }, 1200);
      } catch (e) {
        console.error('Copy failed', e);
      }
    },
    
    deleteEntry(item) {
      this.history = this.history.filter(h => h.key !== item.key);
      this.saveHistory();
    },
    
    formatDate(iso) {
      try {
        return iso?.slice(0, 10) || '';
      } catch {
        return '';
      }
    }
  };
}

(function (global) {
  class CoverFinder {
    constructor() {
      this.placeholderBase = 'https://placehold.co/512x512?text=';
    }

    // Public API: returns { coverUrl, caption, spotifyUrl }
    async getCoverAndLinks(artist, album) {
      const spotifySearchUrl = this.getSpotifySearchUrl(artist, album);

      // 1) MusicBrainz + CAA, then Spotify via MB relations
      const mbid = await this.lookupMBID(artist, album);
      if (mbid) {
        const caa = await this.tryCAA(mbid);
        if (caa) {
          return { coverUrl: caa, caption: 'Cover via Cover Art Archive', spotifyUrl: spotifySearchUrl };
        }
        const sp = await this.lookupSpotifyFromMBID(mbid);
        if (sp) {
          return { coverUrl: sp.thumb, caption: 'Cover via Spotify', spotifyUrl: sp.url };
        }
      }

      // 2) iTunes fallback
      const itunes = await this.lookupItunes(artist, album);
      if (itunes) {
        return { coverUrl: itunes, caption: 'Cover via iTunes', spotifyUrl: spotifySearchUrl };
      }

      // 3) Placeholder
      const safe = encodeURIComponent(`${artist}\n${album}`);
      return { coverUrl: `${this.placeholderBase}${safe}`, caption: 'Placeholder', spotifyUrl: spotifySearchUrl };
    }

    // Link builders
    getYouTubeMusicUrl(artist, album) {
      const q = encodeURIComponent(`${artist} ${album}`);
      const spAlbums = 'EgWKAQIYAWoKEAUQChADEAQQBQ%3D%3D'; // Albums filter
      return `https://music.youtube.com/search?q=${q}&sp=${spAlbums}`;
    }

    getSpotifySearchUrl(artist, album) {
      return `https://open.spotify.com/search/${encodeURIComponent(artist + ' ' + album)}`;
    }

    // MusicBrainz: find release-group MBID
    async lookupMBID(artist, album) {
      try {
        const query = `artist:"${artist}" AND releasegroup:"${album}" AND type:album`;
        const url = 'https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=1&query=' + encodeURIComponent(query);
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return null;
        const data = await res.json();
        return data['release-groups']?.[0]?.id ?? null;
      } catch {
        return null;
      }
    }

    // Cover Art Archive: probe common sizes
    async tryCAA(mbid) {
      const sizes = ['front-500', 'front-250', 'front'];
      for (const s of sizes) {
        const url = `https://coverartarchive.org/release-group/${mbid}/${s}`;
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) return url;
        } catch {}
      }
      return null;
    }

    // Spotify via MB relations + oEmbed
    async lookupSpotifyFromMBID(mbid) {
      try {
        const url = `https://musicbrainz.org/ws/2/release-group/${mbid}?inc=url-rels&fmt=json`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return null;
        const data = await res.json();
        const rels = data.relations || [];
        const spRel = rels.find(r => r.url?.resource?.includes('open.spotify.com/album/'));
        if (!spRel) return null;
        const spUrl = spRel.url.resource;
        const thumb = await this.getSpotifyOEmbedCover(spUrl);
        if (!thumb) return null;
        return { url: spUrl, thumb };
      } catch {
        return null;
      }
    }

    async getSpotifyOEmbedCover(spotifyUrl) {
      try {
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.thumbnail_url || null;
      } catch {
        return null;
      }
    }

    // iTunes Search API
    async lookupItunes(artist, album) {
      try {
        const term = encodeURIComponent(`${artist} ${album}`);
        const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=1`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const item = data.results?.[0];
        if (!item?.artworkUrl100) return null;
        return item.artworkUrl100.replace('100x100bb.jpg', '512x512bb.jpg');
      } catch {
        return null;
      }
    }
  }

  global.CoverFinder = CoverFinder;
})(window);

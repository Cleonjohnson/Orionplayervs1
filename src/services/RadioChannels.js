/**
 * Orion Player 2.0 - Jamaican Radio Stations (curated list)
 * Synced with DatabaseService.syncRadio() built-in list.
 * Culture FM uses the in-app logo asset.
 */

const CULTURE_FM_LOGO = require('../../assets/images/culture-fm-logo.png');

export const RADIO_CHANNELS = [
  { id: 'iriefm', name: 'Irie FM 107.7', url: 'https://usa19.fastcast4u.com:7430/;', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Irie_FM_logo.png/220px-Irie_FM_logo.png', tag: 'Reggae' },
  { id: 'culture965', name: 'Culture FM 96.5', url: 'https://stream.zeno.fm/pagu8b4f9yzuv', logo: CULTURE_FM_LOGO, tag: 'Tune in, Wise up, Get Cultured' },
  { id: 'zip103', name: 'Zip 103 FM', url: 'https://stream.zeno.fm/c0ytcn43vxquv', logo: 'https://zipfm.net/wp-content/uploads/2023/12/logo.svg', tag: 'Dancehall' },
  { id: 'rjr94', name: 'Radio Jamaica 94FM', url: 'https://stream.zeno.fm/cub84trbgy5tv', logo: 'http://rjr94fm.com/wp-content/uploads/2021/06/radio-jamaica-94_logo.png', tag: 'News/Talk' },
  { id: 'love101', name: 'Love 101 FM', url: 'https://stream.zeno.fm/webzstrtpy5tv', logo: 'https://love101.org/wp-content/uploads/2022/03/Love-FM-Logo-150x150.png', tag: 'Gospel' },
  { id: 'nationwide', name: 'Nationwide 90FM', url: 'http://stream.zenolive.com/a3wmsfazfv5tv', logo: 'https://nationwideradiojm.com/wp-content/uploads/2015/04/NNN-app-Logo-512-01.png', tag: 'News' },
  { id: 'kool97', name: 'Kool 97 FM', url: 'https://stream.zeno.fm/we0agoxeeojvv', logo: 'https://www.kool97fm.com/images/joomlabuff/logo/logo1.png', tag: 'Classic' },
  { id: 'ncufm', name: 'NCU 91.1 FM', url: 'https://stream.zeno.fm/qvv8y1m06umtv', logo: 'https://radiosjamaica.com/sites/default/files/styles/116_x_116/public/radio/logos/logo-ncu-fm.png', tag: 'Variety' },
  { id: 'mello88', name: 'Mello FM 88.1', url: 'http://peridot.streamguys.com:5660/live', logo: 'https://radiosjamaica.com/sites/default/files/styles/116_x_116/public/radio/logos/logo-mello-radio-montego-bay.png', tag: 'Easy Listening' },
  { id: 'roots961', name: 'Roots 96.1 FM', url: 'https://stream.zeno.fm/pnp236t7nbruv', logo: 'https://radiosjamaica.com/sites/default/files/styles/116_x_116/public/radio/logos/logo-roots-961-fm.png', tag: 'Reggae' },
  { id: 'stylz', name: 'Stylz FM', url: 'https://stream.zeno.fm/0d1hpcmqqy5tv', logo: 'https://stylzfm.com/sites/default/files/favicon.ico', tag: 'Love Songs' },
  { id: 'tbc', name: 'TBC Radio 88.5 FM', url: 'https://stream.zeno.fm/004dvn2qqy5tv', logo: 'https://tbcradio.org/wp-content/uploads/logo.png', tag: 'Religious' },
  { id: 'newstalk93', name: 'Newstalk 93 FM', url: 'http://procyon.shoutca.st:8083/quality196', logo: 'https://newstalk93fm.net/wp-content/uploads/2020/06/apple-icon-144x144-1.png', tag: 'News/Talk' },
  { id: 'edge105', name: 'The Edge 105 FM', url: 'https://listen.radioking.com/radio/331171/stream/387835', logo: 'https://edge105.com/wp-content/uploads/2022/04/Edge105-2021-Logo-768x580.png', tag: 'Hits' },
  { id: 'fyah105', name: 'Fyah 105', url: 'https://listen.radioking.com/radio/459389/stream/514595', logo: 'https://fyah105.com/wp-content/uploads/2022/09/Fyah-Web-e1663874165334-768x654.jpg', tag: 'Dancehall' },
  { id: 'suncity', name: 'SunCity 104.9 FM', url: 'https://edge.mixlr.com/channel/ibrdq', logo: 'https://radiosjamaica.com/sites/default/files/styles/116_x_116/public/radio/logos/logo-suncity-radio.png', tag: 'Variety' },
  { id: 'klas', name: 'KLAS Sports Radio 89.5', url: 'http://stream.zenolive.com/4uw093pbyvduv', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Radio_icon.svg/240px-Radio_icon.svg.png', tag: 'Sports' },
  { id: 'gospelfm', name: 'Gospel FM Jamaica', url: 'https://stream-37.zeno.fm/zpksre88rm0uv', logo: 'https://www.gospelfmjamaica.com/wp-content/uploads/2022/01/gospel-fm-logo.png', tag: 'Gospel' },
  { id: 'alphaboys', name: 'Alpha Boys School Radio', url: 'http://alphaboys-live.streamguys1.com/alphaboys.mp3', logo: 'https://static.wixstatic.com/media/a09246_33fe4aef6e5f4f17b605a8d8645ff015%7emv2.png/v1/fill/w_192%2Ch_192%2Clg_1%2Cusm_0.66_1.00_0.01/a09246_33fe4aef6e5f4f17b605a8d8645ff015%7Emv2.png', tag: 'Ska/Reggae' },
  { id: 'rebel', name: 'Rebel Radio', url: 'https://streamer.radio.co/s830ce6f36/listen', logo: 'https://www.facebook.com/favicon.ico', tag: 'Urban' },
  { id: 'ggfm', name: 'GGFM 90.1 Discovery Bay', url: 'http://usa14.fastcast4u.com:5192/;', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Radio_icon.svg/240px-Radio_icon.svg.png', tag: 'Community' },
  { id: 'unityxm', name: 'UnityXM', url: 'https://a8.asurahosting.com:7430/radio.mp3', logo: 'https://unityxm.com/assets/images/favicon.png?v=6f0682f6', tag: 'Reggae' },
  { id: 'pondends', name: 'PONdENDS.COM', url: 'http://s7.voscast.com:7000/', logo: 'https://cdn-web.tunein.com/assets/img/apple-touch-icon-180.png', tag: 'Dancehall' },
  { id: 'worlvybz', name: 'Worlvybz Radio', url: 'http://stream.zeno.fm/mkg0g0t2td0uv', logo: 'https://cdn2.editmysite.com/images/site/footer/og-image-placeholder-blank.png', tag: 'Dancehall' },
  { id: 'iriestorm', name: 'IRIE Storm Radio', url: 'https://auds1.intacs.com/iriestormradio', logo: 'http://iriestormradio.com/wp-content/uploads/2020/07/IrieStormLogo300x152.png', tag: 'Reggae' },
  { id: 'reggaecast', name: '808 Live Reggaecast', url: 'http://808.rastamusic.com/rastamusic.mp3', logo: 'https://static.wixstatic.com/media/a09246_33fe4aef6e5f4f17b605a8d8645ff015%7Emv2.png/v1/fill/w_192%2Ch_192%2Clg_1%2Cusm_0.66_1.00_0.01/a09246_33fe4aef6e5f4f17b605a8d8645ff015%7Emv2.png', tag: 'Reggae' },
];

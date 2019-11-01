'use strict';

const fs = require('fs');
const path = require('path');

const request = require('request');
const snoowrap = require('snoowrap');
const Gfycat = require('gfycat-sdk');

const config = require('./config');

const reddit = new snoowrap(config.reddit);
const gfycat = new Gfycat(config.gfycat);
const IMGUR_API_URL = 'https://api.imgur.com/3';

const redditUser = reddit.getMe();
redditUser.getSavedContent().fetchAll().then(res => {
    res.forEach(t => {
        if (t.is_self) return;
        download(t.url);
    });
});

function download(url) {
    if (url.includes('gfycat')) {
        downloadGfycat(url);
    } else if (url.includes('imgur')) {
        downloadImgur(url);
    } else if (/\.(?:jpg|png|gif|gifv|webm|mp4)/.test(url)) {
        downloadAndSaveImage(url);
    }
}

function downloadGfycat(url) {
    // Get everything after the last slash.
    const gfyId = url.match(/\/([^\/]+)$/)[1];
    gfycat.getGifDetails({ gfyId: gfyId })
        .then(gif => {
            downloadAndSaveImage(gif.gfyItem.mp4Url)
        }).catch(err => console.error(err));
}

function downloadImgur(url) {
    // Get the image id
    const imgurId = url.match(/\/([^\/\.]+)(?:\.\w+)?$/)[1];
    let apiURL = IMGUR_API_URL;

    if (url.includes('/gallery/') || url.includes('/album/')) {
        apiURL += '/album';
    } else {
        apiURL += '/image';
    }

    request(`${apiURL}/${imgurId}`, {
        headers: { Authorization: `Client-ID ${config.imgur.clientId}` }
    }, (err, res, body) => {
        if (err) return console.error(err);
        if (res.statusCode !== 200) return console.error(`Failure: ${apiURL}/${imgurId}`);

        body = JSON.parse(body);

        if (body.data.is_album) {
            downloadAndSaveImgurAlbum(body.data);
        } else {
            downloadAndSaveImage(body.data.mp4 || body.data.link);
        }
    });
}

function downloadAndSaveImgurAlbum(imgurData) {
    const albumDir = path.join(config.storageDir, imgurData.id);

    fs.stat(filepath, (err, stats) => {
        if (err && err.code !== 'EEXIST') return console.error(err);
        if (err && err.code === 'EEXIST') console.log(`Found '${filename}' - Skipping album download.`);

        fs.mkdir(albumDir, (err) => {
            if (err) return console.error(err);
            imgurData.images.forEach(image => downloadAndSaveImage(image.link, albumDir));
        });
    });
}

function downloadAndSaveImage(url, storageDirOverride) {
    const filename = url.match(/\/([^\/]+)$/)[1];
    const filepath = path.join(storageDirOverride || config.storageDir, filename);

    fs.stat(filepath, (err, stats) => {
        if (err && err.code !== 'ENOENT') return console.error(err);
        if (stats && stats.isFile()) return console.log(`Found '${filename}' - Skipping download.`);

        request(url)
            .pipe(fs.createWriteStream(filepath, { flags: 'wx' }));
    });
}

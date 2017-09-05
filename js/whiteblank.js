    this.AudioPlayer = (function() {
        AudioPlayer.States = {
            Ready: 0,
            Playing: 1,
            Loading: 2,
            Error: 3,
            Ended: 4
        };

        AudioPlayer.prototype.audioPlayerEvents = ["abort", "error", "play", "playing", "seeked", "pause", "ended", "canplay", "loadstart", "loadeddata", "canplaythrough", "seeking", "stalled", "waiting", "progress"];

        function AudioPlayer(audioContainerElement) {
            this.audioElement = document.createElement("audio");
            this.tracks = [];
            $(audioContainerElement).append(this.audioElement);
            this.selectedTrack = null;
            this._bindEvents();
            this.ui = null;
        }

        AudioPlayer.prototype.setTracks = function(jsonFile){
            // hack to fix “not well-formed” warning when loading client-side JSON in Firefox via jQuery.ajax
            $.ajaxSetup({
                mimeType: "application/json"
            });
            // Use ajax instead of getJSON to force async to false.
            // Otherwise, the process may not be done when we try to get a track.
            $.ajax({
                url: jsonFile,
                dataType: 'json',
                async: false,
                data: {},
                success: function(data) {
                    for (var trackObject in data) {
                        // Take name without whitespaces for id.
                        var currentTrack = data[trackObject];
                        currentTrack.id = trackObject.toString();
                        this.tracks.push(currentTrack);
                    }
                }.bind(this)
            });
        };

        //$.getJSON("tracks.json", {}, function(data) {
        // Now use this data to update your view models, 
        // and Knockout will update your UI automatically 
        // for (var trackObject in data) {
        // Take name without whitespaces for id.
        //     var currentTrack = data[trackObject];
        //    currentTrack.id = trackObject.toString();
        //    self.tracks.push(currentTrack);
        //  }
        //  });

        AudioPlayer.prototype.setUI = function(ui) {
            this.ui = ui;
        };


        AudioPlayer.prototype.tracks = function() {
            return this.tracks;
        };

        AudioPlayer.prototype.selectedTrack = function() {
            return this.selectedTrack;
        };

        AudioPlayer.prototype.selectTrack = function(selectedTrack) {
            this.selectedTrack = selectedTrack;
            var wasPlaying = this.isPlaying();
            this._updateSourceAttributes(this.selectedTrack.source);
            this.load();
            if(wasPlaying){
                this.play();
            }else{
                this.pause();
            }
            if(this.ui){
                this.ui.updateTrack(this.selectedTrack);
            }
        };

        AudioPlayer.prototype.play = function() {
            if (this.isEmpty()) {
                this.updateState(AudioPlayer.States.Loading);
            }
            this.audioElement.play();
        };

        AudioPlayer.prototype.pause = function() {
            return this.audioElement.pause();
        };

        AudioPlayer.prototype.togglePlayPause = function() {
            if (this.isPlaying()) {
                this.pause();
            } else {
                this.play();
            }
        };

        AudioPlayer.prototype.next = function() {
            var nextTrackIndex = this.getSelectedTrackIndex() + 1;
            if (this.tracks.length > nextTrackIndex) {
                this.selectTrack(this.tracks[nextTrackIndex]);
            }
            if(this.ui){
                this.ui.updateTrack(this.selectedTrack);
            }
        };


        AudioPlayer.prototype.previous = function() {
            var previousTrackIndex = this.getSelectedTrackIndex() - 1;
            if (previousTrackIndex >= 0) {
                this.selectTrack(this.tracks[previousTrackIndex]);
            }else{
                // previous on first track goes back to the beginning.
                this.seekTo(0);
            }
            if(this.ui){
                this.ui.updateTrack(this.selectedTrack);
            }
        };


        AudioPlayer.prototype.load = function() {
            return this.audioElement.load();
        };

        AudioPlayer.prototype.getCurrentTime = function() {
            return this.audioElement.currentTime;
        };

        AudioPlayer.prototype.seekTo = function(time) {
            return this.audioElement.currentTime = parseInt(time, 10);
        };


        AudioPlayer.prototype.selectTrackById = function(trackId){
            var foundTrack = this.tracks.find(function(selectedTrack){
                return selectedTrack.id === trackId;
            });
            if(foundTrack){
                this.selectTrack(foundTrack);
            }
        };

        AudioPlayer.prototype.getSelectedTrackIndex = function(){
            return this.tracks.indexOf(this.selectedTrack);
        };

        AudioPlayer.prototype.updateState = function(e) {
            var newState;
            if (this.isErrored()) {
                newState = AudioPlayer.States.Error;
            } else if (this.isLoading()) {
                newState = AudioPlayer.States.Loading;
            } else if (this.isPlaying()) {
                newState = AudioPlayer.States.Playing;
            } else if (this.isEnded()) {
                newState = AudioPlayer.States.Ended;
                if(this.getSelectedTrackIndex() < this.tracks.length - 1) {
                    this.next();
                    this.play();
                }else{
                    // put the track back to the begining.
                    this.seekTo(0);
                    this.pause();
                }
            } else {
                newState = AudioPlayer.States.Ready;
                this._timeUpdate();
            }
            if (this.state !== newState) {
                this.state = newState;
                if (this.ui != null) {
                    this.ui.updateState();
                }
            }
        };

        AudioPlayer.prototype._updateSourceAttributes = function() {
            while (this.audioElement.firstChild) {
                this.audioElement.removeChild(this.audioElement.firstChild);
            }
            if (this.selectedTrack) {
                var sourceElement = document.createElement("source");
                sourceElement.setAttribute("src", this.selectedTrack.source);
                sourceElement.setAttribute("type", "audio/mp3");
                this.audioElement.appendChild(sourceElement);
            }
        };

        AudioPlayer.prototype.getDuration = function() {
            return this.audioElement.duration;
        };

        AudioPlayer.prototype.getCurrentTrack = function() {
            return this.currentTrack;
        };

        AudioPlayer.prototype.isPlaying = function() {
            return this.audioElement && !this.audioElement.paused;
        };

        AudioPlayer.prototype.isPaused = function() {
            return this.audioElement && this.audioElement.paused;
        };

        AudioPlayer.prototype.isLoading = function() {
            if (!this.state && this.isEmpty()) {
                return false;
            }
            return this.audioElement.networkState === this.audioElement.NETWORK_LOADING && this.audioElement.readyState < this.audioElement.HAVE_FUTURE_DATA;
        };

        AudioPlayer.prototype.isErrored = function() {
            return this.audioElement.error || this.audioElement.networkState === this.audioElement.NETWORK_NO_SOURCE;
        };

        AudioPlayer.prototype.isEmpty = function() {
            return this.audioElement.readyState === this.audioElement.HAVE_NOTHING;
        };

        AudioPlayer.prototype.isEnded = function() {
            return this.audioElement.ended;
        };


        AudioPlayer.prototype.getPercentCompleted = function() {
            var number;
            number = ~~((this.audioElement.currentTime / this.audioElement.duration) * 10000);
            return number / 10000;
        };

        AudioPlayer.prototype.handleEvent = function(event) {
            var eventType = event.type;
            if (eventType && this.audioPlayerEvents.indexOf(eventType) >= 0) {
                this.updateState(event);
            } else if (event.type === "timeupdate") {
                this._timeUpdate(event);
            }
        };

        AudioPlayer.prototype._formatTime = function(currentTime) {
            var sec_num = parseInt(currentTime, 10); // don't forget the second param
            var minutes = Math.floor(sec_num / 60);
            var seconds = sec_num - (minutes * 60);
            if (minutes < 10) {
                minutes = "0" + minutes;
            }
            if (seconds < 10) {
                seconds = "0" + seconds;
            }
            return minutes + ":" + seconds;
        };


        AudioPlayer.prototype._timeUpdate = function(e) {
            if (!this.isLoading()) {
                if (this.ui != null) {
                    var percentComplete = void 0;
                    percentComplete = this.getPercentCompleted();
                    var currentTime = this._formatTime(this.getCurrentTime());
                    var duration = this._formatTime(this.getDuration());
                    this.ui.updateTime(percentComplete, currentTime, duration);
                }
            }
        };

        AudioPlayer.prototype.destroy = function() {
            this.ui = null;
            this._unbindEvents();
        };

        AudioPlayer.prototype._bindEvents = function() {
            for (var i = 0; i < this.audioPlayerEvents.length; i++) {
                var eventName = this.audioPlayerEvents[i];
                this.audioElement.addEventListener(eventName, this);
            }
            this.audioElement.addEventListener("timeupdate", this);
        };

        AudioPlayer.prototype._unbindEvents = function() {
            for (var i = 0; i < this.audioPlayerEvents.length; i++) {
                var eventName = this.audioPlayerEvents[i];
                this.audioElement.removeEventListener(eventName, this);
            }
            this.audioElement.removeEventListener("timeupdate", this);
        };

        return AudioPlayer;

    })();

    var $mainContent = $('.main-content');
    var $header = $('.main-header');
    var $sidebar = $('.side-nav');
    var $sidebarTrigger = $('.nav-trigger');
    var $topNavigation = $('.top-nav');
    var $audioContainerElement = $("#audio-player-container");
    var $progressContainer = $audioContainerElement.find(".audio-player-progress");
    var $playButton = $audioContainerElement.find(".audio-player-play-pause");
    var $spinner = $("#spinner");
    var $backgroundPicture = $("#background-picture");
    var $modalBody = $(".modal-body");
    var $modalWindow = $("#modal-window");
    var $trackList = $(".track-list");

    function AudioPlayerUI() {

        var self = this;
        self.audioPlayer = new AudioPlayer($audioContainerElement);
        self.audioPlayer.setTracks("tracks.json");
        self.tracks = ko.observableArray(self.audioPlayer.tracks);
        self.audioPlayer.setUI(self);
        self.currentTrack = ko.observable();
        self.totalDuration = ko.observable();
        self.currentTime = ko.observable();
        self.progressBar = ko.observable();
        self.modalTitle = ko.observable();
        self.modalBody = ko.observable();
        self.currentTrackIndex = undefined;


        self.togglePlayPause = function() {
            self.audioPlayer.togglePlayPause();
        };


        self.selectTrack = function(track) {
            self.audioPlayer.selectTrack(track);
        };


        self.selectTrackFromSidebar = function(track) {
            self.selectTrack(track);
            $([$sidebar, $sidebarTrigger]).toggleClass('nav-is-visible');
            self.audioPlayer.play();
            // propagate the click so that it updates also the href.
            return true;
        };


        self.updateTrack = function(track){
            self.currentTrack(track);
            var $trackList = $(".track-list");
            $trackList.removeClass("active");
            $("#" + track.id).parent('li').addClass('active');
            $audioContainerElement.css("display", "block");
            $sidebar.css("bottom", "0");
            $backgroundPicture.css("display", "block");
        };

        self.next = function() {
            self.audioPlayer.next();
            $([$sidebar, $sidebarTrigger]).removeClass('nav-is-visible');
        };


        self.previous = function() {
            self.audioPlayer.previous();
            $([$sidebar, $sidebarTrigger]).removeClass('nav-is-visible');
        };


        self.seek = function(data, event) {
            var offset = event.offsetX;
            var originalEvent = event.originalEvent;
            if (offset || (originalEvent != null ? originalEvent.layerX : void 0)) {
                var percent = offset / $progressContainer.width();
                var duration = self.audioPlayer.getDuration();
                var seekTo = duration * percent;
                self.audioPlayer.seekTo(seekTo);
            }
        };


        self.showHome = function() {
            self.audioPlayer.pause();
            $audioContainerElement.css("display", "none");
            $sidebar.css("bottom", "-80px");
            $("#background-picture").css("display", "none");
            var $trackList = $(".track-list");
            $trackList.removeClass("active");
            $([$sidebar, $sidebarTrigger]).removeClass('nav-is-visible');
            self.currentTrack("");
        };


        self.updateState = function(state) {
            // this.audioElement.toggleClass("error", this.audioPlayer.isErrored());
            if (self.audioPlayer.isLoading()) {
                self.currentTrack(self.audioPlayer.selectedTrack);
                $spinner.css("display", "block");
            } else {
                $spinner.css("display", "none");
            }
            if (self.audioPlayer.isPlaying()) {
                $playButton.removeClass("fa-play-circle").addClass("fa-pause-circle");
            } else {
                $playButton.removeClass("fa-pause-circle").addClass("fa-play-circle");
            }
            if(self.audioPlayer.isEnded()){
                self.next();
                self.audioplayer.play();
            }
        };


        self.updateTime = function(percentComplete, currentTime, duration) {
            self.progressBar(percentComplete * 100 + "%");
            self.currentTime(currentTime);
            self.totalDuration(duration);
        };


        self.openModal = function() {
            $modalBody.height("100%");
            $modalBody.width("100%");
            $modalWindow.css("display", "block");
            var maxHeight = $(window).height() - 200;
            var maxWidth = 570;
            var bodyHeight = $modalBody.height();
            var bodyWidth = $modalBody.width();
            var newHeight;
            if (bodyHeight >= maxHeight) {
                newHeight = maxHeight;
            } else {
                newHeight = "auto";
            }
            if (bodyWidth >= maxWidth) {
                newWidth = maxWidth;
            } else {
                newWidth = "100%";
            }

            $modalBody.height(newHeight);
            $modalBody.width(newWidth);
            $modalWindow.css("opacity", "1");
        };


        self.closeModal = function() {
            $modalWindow.css("display", "none");
            $modalWindow.css("opacity", "0");
        };


        self.showVideo = function() {
            self.modalTitle("Video");
            self.modalBody($("#video-frame").html());
            self.audioPlayer.pause();
            self.openModal();
            $("iframe").width($modalWindow.width() - 30);
            $("iframe").height($modalWindow.height() - 50);
        };


        self.showLyrics = function() {
            self.modalTitle("Lyrics");
            self.modalBody(self.currentTrack().lyrics);
            self.openModal();
        };

        self.showInfo = function() {
            self.modalTitle("Info");
            self.modalBody(self.currentTrack().info);
            self.openModal();
        };

        self.showAbout = function() {
            self.modalTitle("About");
            self.modalBody($("#about").html());
            self.openModal();
            $(".thumbnail-face").width("100%");
        };

        // //mobile only - open $sidebar when user clicks the hamburger menu
        self.toggleMenu = function(data, event) {
            event.preventDefault();
            $([$sidebar, $sidebarTrigger]).toggleClass('nav-is-visible');
        };


        self.homeScreenClick = function(){
            self.selectTrack(self.tracks()[0]);
        };

    }

var audioPlayerUI = new AudioPlayerUI();
ko.applyBindings(audioPlayerUI);


    var resizing = false;
    moveNavigation();
    $(window).on('resize', function() {
        if (!resizing) {
            (!window.requestAnimationFrame) ? setTimeout(moveNavigation, 300): window.requestAnimationFrame(moveNavigation);
            resizing = true;
        }
    });


    function checkDevice() {
        //check if mobile or desktop device
        return window.getComputedStyle(document.querySelector('.main-content'), '::before').getPropertyValue('content').replace(/'/g, "").replace(/"/g, "");
    }

    function moveNavigation() {
        // small screen
        var device = checkDevice();
        if (device == 'mobile' && $topNavigation.parents('.side-nav').length == 0) {
            $topNavigation.detach();
            $topNavigation.appendTo($sidebar);
            // big screen
        } else if ((device == 'tablet' || device == 'desktop') && $topNavigation.parents('.side-nav').length > 0) {
            $topNavigation.detach();
            $topNavigation.appendTo($header.find('.nav'));
        }
        resizing = false;
    }

/**
 * Selects a track if specified by its id after the hashtag # on the url.
 * @param {} function
 */
function selectTrackFromURL() {
    var url = document.URL;
    var hashTagIndex = url.indexOf('#');
    if(hashTagIndex === -1) return;
    var trackId = url.substring(hashTagIndex + 1);
    audioPlayerUI.audioPlayer.selectTrackById(trackId);
    $sidebar.removeClass('nav-is-visible');
    $sidebarTrigger.removeClass('nav-is-visible');
}

setTimeout(selectTrackFromURL, 10);

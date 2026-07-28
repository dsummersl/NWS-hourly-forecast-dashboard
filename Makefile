.PHONY: video-demo

video-demo:
	marp video-demo/deck.md --images png --image-scale 2 -o video-demo/slides/slide.png
	uv tool run shot-scraper video video-demo/storyboard.yml -o video-demo/demo.webm --mp4

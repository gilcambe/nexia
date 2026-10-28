import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({ log: true });

export async function assembleVideo({ images, audio, srt }) {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  // Add images to ffmpeg
  images.forEach((image, index) => {
    ffmpeg.FS('writeFile', `image${index}.png`, fetchFile(image));
  });

  // Add audio to ffmpeg
  ffmpeg.FS('writeFile', 'audio.mp3', fetchFile(audio));

  // Add subtitles to ffmpeg
  ffmpeg.FS('writeFile', 'subtitles.srt', new TextEncoder().encode(srt));

  // Create a text file with the ffmpeg commands
  const commands = [
    // Create a video from images
    `-framerate 1/5 -i image%d.png -c:v libx264 -r 30 -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" video.mp4`,

    // Add audio to the video
    `-i audio.mp3 -c:v copy -c:a aac -strict experimental video_with_audio.mp4`,

    // Add subtitles to the video
    `-i video_with_audio.mp4 -vf "subtitles=subtitles.srt:force_style='Fontsize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3'" -c:a copy output.mp4`
  ];

  // Execute the commands
  for (const command of commands) {
    await ffmpeg.run(...command.split(' '));
  }

  // Read the output file
  const data = ffmpeg.FS('readFile', 'output.mp4');

  // Create a Blob from the data
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  return blob;
}

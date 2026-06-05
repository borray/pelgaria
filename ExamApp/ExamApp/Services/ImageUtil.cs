using System;
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace ExamApp.Services
{
    /// <summary>Загрузка/нормализация картинок (уменьшение размера, перекодирование в PNG).</summary>
    public static class ImageUtil
    {
        /// <summary>Читает файл и нормализует. Возвращает null при ошибке.</summary>
        public static byte[]? FromFile(string path, int maxDim = 1200)
        {
            try
            {
                return Normalize(File.ReadAllBytes(path), maxDim);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>Берёт изображение из буфера обмена (или null, если его там нет).</summary>
        public static byte[]? FromClipboard(int maxDim = 1200)
        {
            try
            {
                if (!System.Windows.Clipboard.ContainsImage()) return null;
                var src = System.Windows.Clipboard.GetImage();
                if (src == null) return null;
                return EncodePng(Resize(src, maxDim));
            }
            catch
            {
                return null;
            }
        }

        /// <summary>Уменьшает большие картинки и перекодирует в PNG, чтобы не раздувать базу.</summary>
        public static byte[] Normalize(byte[] input, int maxDim = 1200)
        {
            try
            {
                var src = Load(input);
                return EncodePng(Resize(src, maxDim));
            }
            catch
            {
                return input;
            }
        }

        private static BitmapSource Load(byte[] data)
        {
            using var ms = new MemoryStream(data);
            var img = new BitmapImage();
            img.BeginInit();
            img.CacheOption = BitmapCacheOption.OnLoad;
            img.StreamSource = ms;
            img.EndInit();
            img.Freeze();
            return img;
        }

        private static BitmapSource Resize(BitmapSource src, int maxDim)
        {
            int longest = Math.Max(src.PixelWidth, src.PixelHeight);
            if (longest <= maxDim) return src;
            double scale = maxDim / (double)longest;
            var scaled = new TransformedBitmap(src, new ScaleTransform(scale, scale));
            scaled.Freeze();
            return scaled;
        }

        private static byte[] EncodePng(BitmapSource src)
        {
            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(src));
            using var ms = new MemoryStream();
            encoder.Save(ms);
            return ms.ToArray();
        }
    }
}

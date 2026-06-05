using System.Collections.Concurrent;
using WpfMath;
using WpfMath.Parsers;

namespace ExamApp.Services
{
    /// <summary>
    /// Рендерит формулы LaTeX в PNG для вставки в PDF.
    /// ВАЖНО: рендеринг использует WPF и должен вызываться из UI-потока.
    /// Результаты кэшируются, поэтому повторный вызов из фонового потока безопасен.
    /// </summary>
    public static class FormulaRenderer
    {
        private static readonly ConcurrentDictionary<string, byte[]?> _cache = new();

        /// <summary>Рендерит формулу в PNG (или null, если строка пуста / некорректна).</summary>
        public static byte[]? RenderToPng(string? latex, double scale = 32.0)
        {
            if (string.IsNullOrWhiteSpace(latex)) return null;

            var key = scale.ToString("0.0") + "|" + latex;
            if (_cache.TryGetValue(key, out var cached)) return cached;

            byte[]? result;
            try
            {
                var parser = WpfTeXFormulaParser.Instance;
                var formula = parser.Parse(latex);
                result = formula.RenderToPng(scale, 0.0, 0.0, "Arial");
            }
            catch
            {
                result = null;
            }

            _cache[key] = result;
            return result;
        }
    }
}

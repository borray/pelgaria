using CommunityToolkit.Mvvm.ComponentModel;
using ExamApp.Data;
using ExamApp.Models;
using ExamApp.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Win32;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Dialogs
{
    public partial class AnswerOptionEdit : ObservableObject
    {
        public int Id { get; set; }
        public int Order { get; set; }

        [ObservableProperty] private string _text = string.Empty;
        [ObservableProperty] private string? _formula;
        [ObservableProperty] private byte[]? _imageData;
        [ObservableProperty] private bool _isCorrect;
    }

    public partial class QuestionImageEdit : ObservableObject
    {
        public int Id { get; set; }
        public int Order { get; set; }

        [ObservableProperty] private byte[] _imageData = System.Array.Empty<byte>();
        [ObservableProperty] private string? _caption;
    }

    public partial class EditQuestionDialog : Window
    {
        public Question Question { get; private set; } = null!;
        public ObservableCollection<AnswerOptionEdit> AnswerOptions { get; } = new();
        public ObservableCollection<QuestionImageEdit> QuestionImages { get; } = new();
        public ObservableCollection<Topic> Topics { get; } = new();
        private readonly bool _isEdit;

        private const string ImageFilter =
            "Изображения|*.png;*.jpg;*.jpeg;*.bmp;*.gif;*.tiff|Все файлы|*.*";

        public EditQuestionDialog(Question? existing = null)
        {
            InitializeComponent();

            using var ctx = new AppDbContext();
            var topics = ctx.Topics.OrderBy(t => t.Name).ToList();
            foreach (var t in topics) Topics.Add(t);

            if (existing != null)
            {
                _isEdit = true;
                Question = new Question
                {
                    Id = existing.Id,
                    Text = existing.Text,
                    Formula = existing.Formula,
                    Type = existing.Type,
                    MaxScore = existing.MaxScore,
                    TopicId = existing.TopicId
                };

                var options = ctx.AnswerOptions
                    .Where(a => a.QuestionId == existing.Id)
                    .OrderBy(a => a.Order)
                    .ToList();
                foreach (var o in options)
                    AnswerOptions.Add(new AnswerOptionEdit
                    {
                        Id = o.Id,
                        Text = o.Text,
                        Formula = o.Formula,
                        ImageData = o.ImageData,
                        IsCorrect = o.IsCorrect,
                        Order = o.Order
                    });

                var images = ctx.QuestionImages
                    .Where(i => i.QuestionId == existing.Id)
                    .OrderBy(i => i.Order)
                    .ToList();
                foreach (var im in images)
                    QuestionImages.Add(new QuestionImageEdit
                    {
                        Id = im.Id,
                        ImageData = im.ImageData,
                        Caption = im.Caption,
                        Order = im.Order
                    });

                Title = "Редактировать вопрос";
            }
            else
            {
                Question = new Question { MaxScore = 1, Type = QuestionType.SingleChoice };
                Title = "Новый вопрос";
            }

            DataContext = this;
            FormulaBox.Text = Question.Formula ?? string.Empty;
        }

        // ----- Answer options -----

        private void AddOption_Click(object sender, RoutedEventArgs e)
        {
            AnswerOptions.Add(new AnswerOptionEdit
            {
                Text = string.Empty,
                IsCorrect = false,
                Order = AnswerOptions.Count + 1
            });
        }

        private void RemoveOption_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is AnswerOptionEdit opt)
                AnswerOptions.Remove(opt);
        }

        private void AddOptionImage_Click(object sender, RoutedEventArgs e)
        {
            if (sender is not Button btn || btn.Tag is not AnswerOptionEdit opt) return;
            var dlg = new OpenFileDialog { Title = "Картинка варианта", Filter = ImageFilter };
            if (dlg.ShowDialog() == true)
            {
                var data = ImageUtil.FromFile(dlg.FileName);
                if (data != null) opt.ImageData = data;
            }
        }

        private void RemoveOptionImage_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is AnswerOptionEdit opt)
                opt.ImageData = null;
        }

        // ----- Question images -----

        private void AddImageFile_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new OpenFileDialog
            {
                Title = "Добавить картинки к вопросу",
                Filter = ImageFilter,
                Multiselect = true
            };
            if (dlg.ShowDialog() == true)
            {
                foreach (var file in dlg.FileNames)
                {
                    var data = ImageUtil.FromFile(file);
                    if (data != null)
                        QuestionImages.Add(new QuestionImageEdit
                        {
                            ImageData = data,
                            Order = QuestionImages.Count + 1
                        });
                }
            }
        }

        private void PasteImage_Click(object sender, RoutedEventArgs e)
        {
            var data = ImageUtil.FromClipboard();
            if (data != null)
                QuestionImages.Add(new QuestionImageEdit
                {
                    ImageData = data,
                    Order = QuestionImages.Count + 1
                });
            else
                MessageBox.Show("В буфере обмена нет изображения.", "Вставка",
                    MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void RemoveImage_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is QuestionImageEdit img)
                QuestionImages.Remove(img);
        }

        // ----- Save / cancel -----

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Question.Text) && QuestionImages.Count == 0
                && string.IsNullOrWhiteSpace(FormulaBox.Text))
            {
                MessageBox.Show("Введите текст вопроса, формулу или добавьте картинку.",
                    "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (Question.TopicId == 0)
            {
                MessageBox.Show("Выберите тему.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (Question.Type != QuestionType.FreeForm && AnswerOptions.Count < 2)
            {
                MessageBox.Show("Добавьте хотя бы 2 варианта ответа.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (Question.Type == QuestionType.SingleChoice && AnswerOptions.Count(o => o.IsCorrect) != 1)
            {
                MessageBox.Show("Для одиночного выбора отметьте ровно 1 правильный ответ.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (Question.Type == QuestionType.MultipleChoice && AnswerOptions.Count(o => o.IsCorrect) < 1)
            {
                MessageBox.Show("Отметьте хотя бы 1 правильный ответ.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var formula = FormulaBox.Text.Trim();
            Question.Formula = string.IsNullOrWhiteSpace(formula) ? null : formula;

            using var ctx = new AppDbContext();
            if (_isEdit)
            {
                var q = await ctx.Questions.FindAsync(Question.Id);
                if (q != null)
                {
                    q.Text = Question.Text;
                    q.Formula = Question.Formula;
                    q.Type = Question.Type;
                    q.MaxScore = Question.MaxScore;
                    q.TopicId = Question.TopicId;

                    ctx.RemoveRange(ctx.AnswerOptions.Where(a => a.QuestionId == q.Id));
                    ctx.RemoveRange(ctx.QuestionImages.Where(i => i.QuestionId == q.Id));
                    await ctx.SaveChangesAsync();
                }
            }
            else
            {
                ctx.Questions.Add(Question);
                await ctx.SaveChangesAsync();
            }

            int order = 1;
            foreach (var opt in AnswerOptions)
            {
                ctx.AnswerOptions.Add(new AnswerOption
                {
                    QuestionId = Question.Id,
                    Text = opt.Text ?? string.Empty,
                    Formula = string.IsNullOrWhiteSpace(opt.Formula) ? null : opt.Formula.Trim(),
                    ImageData = opt.ImageData,
                    IsCorrect = opt.IsCorrect,
                    Order = order++
                });
            }

            int imgOrder = 1;
            foreach (var img in QuestionImages)
            {
                ctx.QuestionImages.Add(new QuestionImage
                {
                    QuestionId = Question.Id,
                    ImageData = img.ImageData,
                    Caption = img.Caption,
                    Order = imgOrder++
                });
            }

            await ctx.SaveChangesAsync();

            DialogResult = true;
            Close();
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
    }
}

using ExamApp.Data;
using ExamApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Dialogs
{
    public class AnswerOptionEdit
    {
        public int Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }
        public int Order { get; set; }
    }

    public partial class EditQuestionDialog : Window
    {
        public Question Question { get; private set; } = null!;
        public ObservableCollection<AnswerOptionEdit> AnswerOptions { get; } = new();
        public ObservableCollection<Topic> Topics { get; } = new();
        private bool _isEdit;

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
                        IsCorrect = o.IsCorrect,
                        Order = o.Order
                    });
                Title = "Редактировать вопрос";
            }
            else
            {
                Question = new Question { MaxScore = 1, Type = QuestionType.SingleChoice };
                Title = "Новый вопрос";
            }

            DataContext = this;
        }

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

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Question.Text))
            {
                MessageBox.Show("Введите текст вопроса.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
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

            using var ctx = new AppDbContext();
            if (_isEdit)
            {
                var q = await ctx.Questions.FindAsync(Question.Id);
                if (q != null)
                {
                    q.Text = Question.Text;
                    q.Type = Question.Type;
                    q.MaxScore = Question.MaxScore;
                    q.TopicId = Question.TopicId;
                    await ctx.SaveChangesAsync();

                    var oldOpts = ctx.AnswerOptions.Where(a => a.QuestionId == q.Id);
                    ctx.RemoveRange(oldOpts);
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
                    Text = opt.Text,
                    IsCorrect = opt.IsCorrect,
                    Order = order++
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

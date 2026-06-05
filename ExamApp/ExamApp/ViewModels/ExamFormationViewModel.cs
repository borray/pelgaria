using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ExamApp.Data;
using ExamApp.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;

namespace ExamApp.ViewModels
{
    public partial class ExamFormationViewModel : BaseViewModel
    {
        [ObservableProperty]
        private ObservableCollection<Exam> _exams = new();

        [ObservableProperty]
        private Exam? _selectedExam;

        [ObservableProperty]
        private ObservableCollection<ExamQuestion> _examQuestions = new();

        [ObservableProperty]
        private ObservableCollection<Topic> _topics = new();

        [ObservableProperty]
        private ObservableCollection<Question> _bankQuestions = new();

        [ObservableProperty]
        private Topic? _filterTopic;

        [ObservableProperty]
        private int _totalMaxScore;

        partial void OnSelectedExamChanged(Exam? value) => _ = LoadExamQuestionsAsync();
        partial void OnFilterTopicChanged(Topic? value) => _ = LoadBankQuestionsAsync();

        public ExamFormationViewModel()
        {
            Title = "Формирование КИМ";
        }

        [RelayCommand]
        public async Task LoadDataAsync()
        {
            using var ctx = new AppDbContext();
            var exams = await ctx.Exams.OrderByDescending(e => e.CreatedAt).ToListAsync();
            Exams.Clear();
            foreach (var e in exams) Exams.Add(e);

            var topics = await ctx.Topics.OrderBy(t => t.Name).ToListAsync();
            Topics.Clear();
            Topics.Add(new Topic { Id = 0, Name = "— Все темы —" });
            foreach (var t in topics) Topics.Add(t);
            FilterTopic = Topics.First();

            await LoadBankQuestionsAsync();

            if (SelectedExam != null)
                await LoadExamQuestionsAsync();
        }

        private async Task LoadBankQuestionsAsync()
        {
            using var ctx = new AppDbContext();
            var query = ctx.Questions.Include(q => q.Topic).Include(q => q.AnswerOptions).AsQueryable();
            if (FilterTopic != null && FilterTopic.Id != 0)
                query = query.Where(q => q.TopicId == FilterTopic.Id);
            var list = await query.OrderBy(q => q.Topic!.Name).ThenBy(q => q.Text).ToListAsync();
            BankQuestions.Clear();
            foreach (var q in list) BankQuestions.Add(q);
        }

        private async Task LoadExamQuestionsAsync()
        {
            if (SelectedExam == null)
            {
                ExamQuestions.Clear();
                TotalMaxScore = 0;
                return;
            }
            using var ctx = new AppDbContext();
            var eqs = await ctx.ExamQuestions
                .Where(eq => eq.ExamId == SelectedExam.Id)
                .Include(eq => eq.Question)
                .ThenInclude(q => q!.Topic)
                .Include(eq => eq.Question)
                .ThenInclude(q => q!.AnswerOptions)
                .OrderBy(eq => eq.Order)
                .ToListAsync();
            ExamQuestions.Clear();
            foreach (var eq in eqs) ExamQuestions.Add(eq);
            TotalMaxScore = ExamQuestions.Sum(eq => eq.Question?.MaxScore ?? 0);
        }

        [RelayCommand]
        public async Task AddQuestionToExamAsync(Question question)
        {
            if (SelectedExam == null || question == null) return;
            using var ctx = new AppDbContext();
            bool exists = await ctx.ExamQuestions.AnyAsync(
                eq => eq.ExamId == SelectedExam.Id && eq.QuestionId == question.Id);
            if (exists) return;

            int maxOrder = await ctx.ExamQuestions
                .Where(eq => eq.ExamId == SelectedExam.Id)
                .Select(eq => (int?)eq.Order)
                .MaxAsync() ?? 0;

            ctx.ExamQuestions.Add(new ExamQuestion
            {
                ExamId = SelectedExam.Id,
                QuestionId = question.Id,
                Order = maxOrder + 1
            });
            await ctx.SaveChangesAsync();
            await LoadExamQuestionsAsync();
        }

        [RelayCommand]
        public async Task RemoveQuestionFromExamAsync(ExamQuestion eq)
        {
            if (eq == null) return;
            using var ctx = new AppDbContext();
            var item = await ctx.ExamQuestions.FindAsync(eq.Id);
            if (item != null)
            {
                ctx.ExamQuestions.Remove(item);
                await ctx.SaveChangesAsync();
                await ReorderAsync(ctx);
            }
            await LoadExamQuestionsAsync();
        }

        [RelayCommand]
        public async Task MoveUpAsync(ExamQuestion eq)
        {
            if (eq == null || eq.Order <= 1) return;
            using var ctx = new AppDbContext();
            var current = await ctx.ExamQuestions.FindAsync(eq.Id);
            var prev = await ctx.ExamQuestions
                .Where(x => x.ExamId == eq.ExamId && x.Order == eq.Order - 1)
                .FirstOrDefaultAsync();
            if (current != null && prev != null)
            {
                current.Order--;
                prev.Order++;
                await ctx.SaveChangesAsync();
            }
            await LoadExamQuestionsAsync();
        }

        [RelayCommand]
        public async Task MoveDownAsync(ExamQuestion eq)
        {
            if (eq == null) return;
            using var ctx = new AppDbContext();
            var current = await ctx.ExamQuestions.FindAsync(eq.Id);
            var next = await ctx.ExamQuestions
                .Where(x => x.ExamId == eq.ExamId && x.Order == eq.Order + 1)
                .FirstOrDefaultAsync();
            if (current != null && next != null)
            {
                current.Order++;
                next.Order--;
                await ctx.SaveChangesAsync();
            }
            await LoadExamQuestionsAsync();
        }

        [RelayCommand]
        public async Task AddRandomQuestionsAsync(object? param)
        {
            if (SelectedExam == null) return;
            if (param is not Tuple<int, int> t) return;
            var (topicId, count) = (t.Item1, t.Item2);

            using var ctx = new AppDbContext();
            var existing = await ctx.ExamQuestions
                .Where(eq => eq.ExamId == SelectedExam.Id)
                .Select(eq => eq.QuestionId)
                .ToListAsync();

            var pool = ctx.Questions.Where(q => !existing.Contains(q.Id));
            if (topicId != 0) pool = pool.Where(q => q.TopicId == topicId);

            var available = await pool.ToListAsync();
            var rng = new Random();
            var picked = available.OrderBy(_ => rng.Next()).Take(count).ToList();

            int maxOrder = await ctx.ExamQuestions
                .Where(eq => eq.ExamId == SelectedExam.Id)
                .Select(eq => (int?)eq.Order)
                .MaxAsync() ?? 0;

            foreach (var q in picked)
            {
                maxOrder++;
                ctx.ExamQuestions.Add(new ExamQuestion
                {
                    ExamId = SelectedExam.Id,
                    QuestionId = q.Id,
                    Order = maxOrder
                });
            }
            await ctx.SaveChangesAsync();
            await LoadExamQuestionsAsync();
        }

        [RelayCommand]
        public async Task DeleteExamAsync(Exam exam)
        {
            if (exam == null) return;
            using var ctx = new AppDbContext();
            var e = await ctx.Exams.FindAsync(exam.Id);
            if (e != null)
            {
                ctx.Exams.Remove(e);
                await ctx.SaveChangesAsync();
            }
            if (SelectedExam?.Id == exam.Id)
                SelectedExam = null;
            await LoadDataAsync();
        }

        private async Task ReorderAsync(AppDbContext ctx)
        {
            if (SelectedExam == null) return;
            var items = await ctx.ExamQuestions
                .Where(eq => eq.ExamId == SelectedExam.Id)
                .OrderBy(eq => eq.Order)
                .ToListAsync();
            for (int i = 0; i < items.Count; i++)
                items[i].Order = i + 1;
            await ctx.SaveChangesAsync();
        }

        public async Task RefreshAsync()
        {
            await LoadDataAsync();
        }
    }
}

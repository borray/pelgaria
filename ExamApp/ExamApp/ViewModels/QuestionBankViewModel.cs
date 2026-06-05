using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ExamApp.Data;
using ExamApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;

namespace ExamApp.ViewModels
{
    public partial class QuestionBankViewModel : BaseViewModel
    {
        [ObservableProperty]
        private ObservableCollection<Topic> _topics = new();

        [ObservableProperty]
        private ObservableCollection<Question> _questions = new();

        [ObservableProperty]
        private Topic? _selectedTopic;

        [ObservableProperty]
        private Question? _selectedQuestion;

        [ObservableProperty]
        private string _searchText = string.Empty;

        partial void OnSelectedTopicChanged(Topic? value) => _ = LoadQuestionsAsync();
        partial void OnSearchTextChanged(string value) => _ = LoadQuestionsAsync();

        public QuestionBankViewModel()
        {
            Title = "Банк вопросов";
        }

        [RelayCommand]
        public async Task LoadDataAsync()
        {
            using var ctx = new AppDbContext();
            var topics = await ctx.Topics.OrderBy(t => t.Name).ToListAsync();
            Topics.Clear();
            Topics.Add(new Topic { Id = 0, Name = "— Все темы —" });
            foreach (var t in topics) Topics.Add(t);
            SelectedTopic = Topics.First();
            await LoadQuestionsAsync();
        }

        private async Task LoadQuestionsAsync()
        {
            using var ctx = new AppDbContext();
            var query = ctx.Questions
                .Include(q => q.Topic)
                .Include(q => q.AnswerOptions)
                .Include(q => q.Images)
                .AsQueryable();

            if (SelectedTopic != null && SelectedTopic.Id != 0)
                query = query.Where(q => q.TopicId == SelectedTopic.Id);

            if (!string.IsNullOrWhiteSpace(SearchText))
                query = query.Where(q => q.Text.Contains(SearchText));

            var list = await query.OrderBy(q => q.Topic!.Name).ThenBy(q => q.Text).ToListAsync();
            Questions.Clear();
            foreach (var q in list) Questions.Add(q);
        }

        [RelayCommand]
        public async Task DeleteTopicAsync(Topic topic)
        {
            if (topic == null || topic.Id == 0) return;
            using var ctx = new AppDbContext();
            var t = await ctx.Topics.FindAsync(topic.Id);
            if (t != null)
            {
                ctx.Topics.Remove(t);
                await ctx.SaveChangesAsync();
            }
            await LoadDataAsync();
        }

        [RelayCommand]
        public async Task DeleteQuestionAsync(Question question)
        {
            if (question == null) return;
            using var ctx = new AppDbContext();
            var q = await ctx.Questions.FindAsync(question.Id);
            if (q != null)
            {
                ctx.Questions.Remove(q);
                await ctx.SaveChangesAsync();
            }
            await LoadQuestionsAsync();
        }

        public async Task RefreshAsync()
        {
            await LoadDataAsync();
        }
    }
}

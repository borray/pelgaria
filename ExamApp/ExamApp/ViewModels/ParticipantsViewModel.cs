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
    public partial class ParticipantsViewModel : BaseViewModel
    {
        [ObservableProperty]
        private ObservableCollection<Participant> _participants = new();

        [ObservableProperty]
        private Participant? _selectedParticipant;

        [ObservableProperty]
        private string _searchText = string.Empty;

        [ObservableProperty]
        private string _filterGroup = string.Empty;

        [ObservableProperty]
        private ObservableCollection<string> _groups = new();

        partial void OnSearchTextChanged(string value) => _ = LoadDataAsync();
        partial void OnFilterGroupChanged(string value) => _ = LoadDataAsync();

        public ParticipantsViewModel()
        {
            Title = "Участники";
        }

        [RelayCommand]
        public async Task LoadDataAsync()
        {
            using var ctx = new AppDbContext();
            var query = ctx.Participants.AsQueryable();

            if (!string.IsNullOrWhiteSpace(SearchText))
                query = query.Where(p =>
                    p.LastName.Contains(SearchText) ||
                    p.FirstName.Contains(SearchText) ||
                    (p.MiddleName != null && p.MiddleName.Contains(SearchText)));

            if (!string.IsNullOrWhiteSpace(FilterGroup) && FilterGroup != "— Все группы —")
                query = query.Where(p => p.GroupName == FilterGroup);

            var list = await query.OrderBy(p => p.GroupName).ThenBy(p => p.LastName).ToListAsync();
            Participants.Clear();
            foreach (var p in list) Participants.Add(p);

            var allGroups = await ctx.Participants
                .Select(p => p.GroupName)
                .Distinct()
                .OrderBy(g => g)
                .ToListAsync();
            Groups.Clear();
            Groups.Add("— Все группы —");
            foreach (var g in allGroups) Groups.Add(g);
        }

        [RelayCommand]
        public async Task DeleteParticipantAsync(Participant participant)
        {
            if (participant == null) return;
            using var ctx = new AppDbContext();
            var p = await ctx.Participants.FindAsync(participant.Id);
            if (p != null)
            {
                ctx.Participants.Remove(p);
                await ctx.SaveChangesAsync();
            }
            await LoadDataAsync();
        }

        public async Task RefreshAsync()
        {
            await LoadDataAsync();
        }
    }
}

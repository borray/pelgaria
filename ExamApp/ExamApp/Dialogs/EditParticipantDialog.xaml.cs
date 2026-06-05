using ExamApp.Data;
using ExamApp.Models;
using System.Windows;

namespace ExamApp.Dialogs
{
    public partial class EditParticipantDialog : Window
    {
        public Participant Participant { get; private set; } = null!;
        private bool _isEdit;

        public EditParticipantDialog(Participant? existing = null)
        {
            InitializeComponent();
            if (existing != null)
            {
                _isEdit = true;
                Participant = new Participant
                {
                    Id = existing.Id,
                    LastName = existing.LastName,
                    FirstName = existing.FirstName,
                    MiddleName = existing.MiddleName,
                    GroupName = existing.GroupName,
                    Email = existing.Email
                };
                Title = "Редактировать участника";
            }
            else
            {
                Participant = new Participant();
                Title = "Новый участник";
            }
            DataContext = Participant;
        }

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Participant.LastName) || string.IsNullOrWhiteSpace(Participant.FirstName))
            {
                MessageBox.Show("Введите фамилию и имя.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (string.IsNullOrWhiteSpace(Participant.GroupName))
            {
                MessageBox.Show("Введите группу.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            using var ctx = new AppDbContext();
            if (_isEdit)
            {
                var p = await ctx.Participants.FindAsync(Participant.Id);
                if (p != null)
                {
                    p.LastName = Participant.LastName;
                    p.FirstName = Participant.FirstName;
                    p.MiddleName = Participant.MiddleName;
                    p.GroupName = Participant.GroupName;
                    p.Email = Participant.Email;
                    await ctx.SaveChangesAsync();
                }
            }
            else
            {
                ctx.Participants.Add(Participant);
                await ctx.SaveChangesAsync();
            }

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

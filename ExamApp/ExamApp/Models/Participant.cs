using System.Collections.Generic;

namespace ExamApp.Models
{
    public class Participant
    {
        public int Id { get; set; }
        public string LastName { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string? MiddleName { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public string? Email { get; set; }

        public string FullName =>
            string.IsNullOrWhiteSpace(MiddleName)
                ? $"{LastName} {FirstName}"
                : $"{LastName} {FirstName} {MiddleName}";

        public ICollection<ParticipantResult> Results { get; set; } = new List<ParticipantResult>();
    }
}

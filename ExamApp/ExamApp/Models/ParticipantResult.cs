using System.Collections.Generic;

namespace ExamApp.Models
{
    public class ParticipantResult
    {
        public int Id { get; set; }
        public int SessionId { get; set; }
        public int ParticipantId { get; set; }
        public string? ScannedBlankPath { get; set; }
        public bool IsChecked { get; set; }
        public int TotalScore { get; set; }

        public ExamSession? Session { get; set; }
        public Participant? Participant { get; set; }
        public ICollection<ParticipantAnswer> Answers { get; set; } = new List<ParticipantAnswer>();
    }
}

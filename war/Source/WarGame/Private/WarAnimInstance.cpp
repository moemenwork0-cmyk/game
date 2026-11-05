#include "WarAnimInstance.h"
#include "Animation/AnimSequence.h"
#include "AnimationRuntime.h"

void UWarAnimInstance::Play(UAnimSequence* Anim, bool bLoop, float Rate, float BlendTime, float StartTime)
{
	Pending.Anim = Anim;
	Pending.bLoop = bLoop;
	Pending.Rate = Rate;
	Pending.Time = StartTime;
	PendingBlend = BlendTime;
	bChanged = true;
	ToTimeGameThread = StartTime;
}

float UWarAnimInstance::CurrentTime() const
{
	return ToTimeGameThread;
}

void FWarAnimProxy::PreUpdate(UAnimInstance* InAnimInstance, float DeltaSeconds)
{
	FAnimInstanceProxy::PreUpdate(InAnimInstance, DeltaSeconds);
	UWarAnimInstance* Owner = CastChecked<UWarAnimInstance>(InAnimInstance);
	if (Owner->bChanged)
	{
		Owner->bChanged = false;
		// Blend from the current mix: keep whichever layer dominates as the source.
		From = Blend >= 0.5f ? To : From;
		To = Owner->Pending;
		BlendTime = FMath::Max(Owner->PendingBlend, 0.01f);
		Blend = To.Anim && From.Anim ? 0.f : 1.f;
	}
	auto Advance = [DeltaSeconds](FLayer& L)
	{
		if (!L.Anim) return;
		const float Len = L.Anim->GetPlayLength();
		L.Time += DeltaSeconds * L.Rate;
		L.Time = L.bLoop && Len > 0.f ? FMath::Fmod(L.Time, Len) : FMath::Min(L.Time, Len);
	};
	Advance(From);
	Advance(To);
	Blend = FMath::Min(1.f, Blend + DeltaSeconds / BlendTime);
	Owner->ToTimeGameThread = To.Time;
}

bool FWarAnimProxy::Evaluate(FPoseContext& Output)
{
	if (!To.Anim)
	{
		Output.ResetToRefPose();
		return true;
	}
	auto Sample = [this](const FLayer& L, FPoseContext& Pose)
	{
		FAnimationPoseData Data(Pose);
		L.Anim->GetAnimationPose(Data, FAnimExtractContext(static_cast<double>(L.Time), false, FDeltaTimeRecord(), L.bLoop));
	};
	if (Blend >= 1.f || !From.Anim)
	{
		Sample(To, Output);
		return true;
	}
	FPoseContext A(this);
	FPoseContext B(this);
	Sample(From, A);
	Sample(To, B);
	FAnimationPoseData DataA(A);
	FAnimationPoseData DataB(B);
	FAnimationPoseData Out(Output);
	const float W = FMath::SmoothStep(0.f, 1.f, Blend);
	FAnimationRuntime::BlendTwoPosesTogether(DataB, DataA, W, Out);
	return true;
}
